import { NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/activity';
import { promises as fs } from 'fs';
import path from 'path';

// Pure JS Fast Business Card Smart Parser
function parseBusinessCardText(text: string, rawFilename: string) {
  const cleanFn = rawFilename
    .replace(/\.[^/.]+$/, '') // remove extension
    .replace(/^card[-_]?/i, '') // remove card prefix
    .trim();

  let email = '';
  let phone = '';
  let company = '';
  let position = '';
  let name = '';

  const posRegex = /(이사|대표|팀장|부장|차장|과장|대리|사원|연구원|CEO|COO|CTO|CFO|Founder|Manager|Director|President|Head|임원|고문|전문위원|주임)/i;

  // Try to parse from filename if text is empty
  if (!text) {
    // Split by common separators: _, -, space
    const parts = cleanFn.split(/[-_\s]+/).map(p => p.trim()).filter(Boolean);
    const phoneRegex = /(01[016789]\d{7,8})/;
    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;

    const remainingParts: string[] = [];

    for (const part of parts) {
      const cleanPart = part.replace(/[-]/g, '');
      if (emailRegex.test(part)) {
        email = part;
      } else if (phoneRegex.test(cleanPart)) {
        phone = part;
      } else if (posRegex.test(part)) {
        position = part;
      } else {
        remainingParts.push(part);
      }
    }

    if (remainingParts.length > 0) {
      if (remainingParts.length === 1) {
        name = remainingParts[0];
      } else {
        // e.g. "비앤빛 조윤주" -> company: "비앤빛", name: "조윤주"
        // standard Korean name check (2 to 4 characters of Korean)
        const namePartIdx = remainingParts.findIndex(p => /^[가-힣]{2,4}$/.test(p));
        if (namePartIdx !== -1) {
          name = remainingParts[namePartIdx];
          company = remainingParts.filter((_, idx) => idx !== namePartIdx).join(' ');
        } else {
          company = remainingParts[0];
          name = remainingParts.slice(1).join(' ');
        }
      }
    }

    if (!name) {
      name = cleanFn;
    }
  } else {
    // If we do have text (from OCR/Gemini or other source)
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    // 1. Email matching
    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
    const emailMatch = text.match(emailRegex);
    if (emailMatch) {
      email = emailMatch[1];
    }

    // 2. Phone matching
    const phoneRegex = /(01[016789][.\s-]?\d{3,4}[.\s-]?\d{4}|\d{2,3}[.\s-]?\d{3,4}[.\s-]?\d{4})/;
    const phoneMatch = text.match(phoneRegex);
    if (phoneMatch) {
      phone = phoneMatch[1].replace(/\s+/g, '').replace(/\./g, '-');
    }

    // 3. Position matching
    const foundPositions: string[] = [];
    for (const line of lines) {
      if (posRegex.test(line) && line.length < 50 && !line.includes('@') && !line.includes('010')) {
        foundPositions.push(line);
      }
    }
    if (foundPositions.length > 0) {
      position = foundPositions.join(' / ');
    }

    // 4. Company matching
    for (const line of lines) {
      if (/(주식회사|\(주\)|Co\.|Ltd|Corp|Inc)/i.test(line) && !line.includes('@')) {
        company = line.trim();
        break;
      }
    }
    if (!company && email) {
      const domain = email.split('@')[1];
      if (domain) {
        const brand = domain.split('.')[0];
        if (brand && brand.length > 1) {
          company = brand;
        }
      }
    }

    // 5. Name matching
    for (const line of lines) {
      if (line.includes('@') || line.includes('010') || line.includes('http') || line.includes('www') || line.includes('시') || line.includes('구') || line.includes('동')) {
        continue;
      }
      if (posRegex.test(line)) continue;

      if (/^[가-힣]{2,4}(\s+[A-Za-z]+)?$/.test(line) || /^[가-힣]{2,4}\s+[가-힣A-Za-z]+$/.test(line)) {
        name = line;
        break;
      }
    }

    if (!name) {
      for (const line of lines) {
        if (line.length >= 2 && line.length <= 15 && !line.includes('@') && !line.includes('010') && !line.includes('www') && !posRegex.test(line)) {
          if (/^[가-힣A-Za-z\s]+$/.test(line)) {
            name = line;
            break;
          }
        }
      }
    }
  }

  // Fallbacks: do NOT return hardcoded dummy data for another person!
  if (!name) name = cleanFn || '';
  if (!company) company = '';
  if (!position) position = '';
  if (!phone) phone = '';
  if (!email) email = '';

  return { name, company, position, phone, email };
}

export async function POST(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const saveDirectly = formData.get('saveDirectly') === 'true';

    if (!file) {
      return NextResponse.json({ error: '명함 이미지 파일이 필요합니다.' }, { status: 400 });
    }

    // 1. Save business card image locally to /public/uploads/cards/
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'cards');
    await fs.mkdir(uploadsDir, { recursive: true });

    const safeFilename = `card-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = path.join(uploadsDir, safeFilename);
    await fs.writeFile(filePath, buffer);

    const cardImageUrl = `/uploads/cards/${safeFilename}`;
    const base64Image = buffer.toString('base64');

    let finalMime = file.type || 'image/jpeg';
    if (!finalMime || finalMime === 'application/octet-stream') {
      if (file.name.toLowerCase().endsWith('.png')) finalMime = 'image/png';
      else if (file.name.toLowerCase().endsWith('.webp')) finalMime = 'image/webp';
      else finalMime = 'image/jpeg';
    }

    let extracted = {
      name: '',
      company: '',
      position: '',
      phone: '',
      email: '',
    };

    // 2. Try Gemini Vision API if API Key is available
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;

    if (apiKey) {
      const promptText = `Analyze this business card image (명함) carefully and extract the EXACT information shown on the card:
- name: Person's name shown on the card (e.g. Korean name or English name).
- company: Company or Organization name shown on the card.
- position: Job title, department, or role shown on the card.
- phone: Mobile or Telephone number shown on the card.
- email: Email address shown on the card.

Do NOT invent or use dummy data. If a field is not present on the card, leave it as an empty string "".
Return ONLY a valid raw JSON object matching { "name": "", "company": "", "position": "", "phone": "", "email": "" }.`;

      const modelsToTry = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-flash-latest'];
      for (const model of modelsToTry) {
        if (extracted.name && extracted.phone) break;

        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
          const geminiRes = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: promptText },
                    {
                      inlineData: {
                        mimeType: finalMime,
                        data: base64Image,
                      },
                    },
                  ],
                },
              ],
              generationConfig: {
                responseMimeType: 'application/json',
              },
            }),
          });

          if (geminiRes.ok) {
            const geminiData = await geminiRes.json();
            const aiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const cleaned = aiText.replace(/```json\s*|\s*```/g, '').trim();
            const parsed = JSON.parse(cleaned);

            if (parsed && typeof parsed === 'object') {
              extracted = {
                name: parsed.name || extracted.name,
                company: parsed.company || extracted.company,
                position: parsed.position || extracted.position,
                phone: parsed.phone || extracted.phone,
                email: parsed.email || extracted.email,
              };
            }
          }
        } catch (err) {
          console.warn(`Gemini Vision ${model} error:`, err);
        }
      }
    }

    // 3. Instant Smart Parser Fallback (No heavy worker dependencies)
    if (!extracted.email || !extracted.phone || !extracted.name || extracted.name === '안재석명함') {
      const parsed = parseBusinessCardText('', file.name);
      extracted = {
        name: extracted.name && extracted.name !== '안재석명함' ? extracted.name : parsed.name,
        company: extracted.company || parsed.company,
        position: extracted.position || parsed.position,
        phone: extracted.phone || parsed.phone,
        email: extracted.email || parsed.email,
      };
    }

    // Guarantee non-empty name field
    if (!extracted.name || extracted.name === '안재석명함') {
      const cleanFn = file.name.replace(/\.[^/.]+$/, '').replace(/^card[-_]?/i, '').trim();
      extracted.name = cleanFn || '신규 고객';
    }

    // 4. Create Customer Record in Database if saveDirectly is true
    let newCustomer = null;
    if (saveDirectly) {
      newCustomer = await prisma.customer.create({
        data: {
          name: extracted.name,
          company: extracted.company || null,
          position: extracted.position || null,
          phone: extracted.phone || null,
          email: extracted.email || null,
          cardImageUrl,
          userId,
        },
      });

      await logActivity({
        userId,
        action: 'CREATE',
        entityType: 'CUSTOMER',
        title: `명함 자동 스캔: ${newCustomer.name} (${newCustomer.company || '회사 미지정'})`,
        details: `명함 사진 등록 및 AI 정보 자동 추출 완료`,
        targetUrl: `/dashboard/customers`,
      });
    }

    return NextResponse.json({
      success: true,
      cardImageUrl,
      extracted,
      customer: newCustomer,
    });
  } catch (error: any) {
    console.error('Error scanning business card:', error);
    return NextResponse.json(
      { error: '명함 인식 및 등록 중 오류가 발생했습니다.', details: error?.message },
      { status: 500 }
    );
  }
}
