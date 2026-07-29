import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projects = await prisma.project.findMany({
      where: { userId },
      include: {
        budget: {
          include: {
            transactions: {
              orderBy: { dueDate: 'asc' },
            },
          },
        },
      },
    });

    let totalContractValue = 0;
    let totalCollectedIncome = 0;
    let totalScheduledIncome = 0;
    let totalPaidExpense = 0;
    let totalScheduledExpense = 0;

    const projectSummaryList: string[] = [];
    const transactionList: string[] = [];

    projects.forEach((p) => {
      const b = p.budget;
      if (!b) return;

      const contract = b.contractAmount || 0;
      totalContractValue += contract;

      const txs = b.transactions || [];
      const pIncome = txs.filter((t) => t.type === 'INCOME');
      const pExpense = txs.filter((t) => t.type === 'EXPENSE');

      const pIncomeColl = pIncome.filter((t) => t.status === 'COMPLETED').reduce((s, t) => s + t.amount, 0);
      const pExpensePaid = pExpense.filter((t) => t.status === 'COMPLETED').reduce((s, t) => s + t.amount, 0);

      totalCollectedIncome += pIncomeColl;
      totalScheduledIncome += pIncome.reduce((s, t) => s + t.amount, 0);
      totalPaidExpense += pExpensePaid;
      totalScheduledExpense += pExpense.reduce((s, t) => s + t.amount, 0);

      projectSummaryList.push(
        `- **${p.name}** (${p.status}): 수주금액 ${contract.toLocaleString()}원, 목표예산 ${(b.targetBudget || 0).toLocaleString()}원, 예정지출 ${pExpense.reduce((s, t) => s + t.amount, 0).toLocaleString()}원`
      );

      txs.forEach((t) => {
        const dateStr = new Date(t.dueDate).toLocaleDateString('ko-KR');
        transactionList.push(
          `- [${dateStr}] [${t.type === 'INCOME' ? '🟢 입금예정' : '🔴 출금예정'}] ${t.title} (${t.category}): ${t.amount.toLocaleString()}원 [상태: ${t.status === 'COMPLETED' ? '완료' : '예정'}] (프로젝트: ${p.name})`
        );
      });
    });

    const netExpectedProfit = totalContractValue - totalScheduledExpense;
    const profitMarginPct = totalContractValue > 0 ? (netExpectedProfit / totalContractValue) * 100 : 0;

    const prompt = `당신은 최고 재무 관리자(CFO) 및 비즈니스 현금 흐름 분석 AI 수석 컨설턴트입니다.
사용자의 프로젝트별 수주금액, 목표예산, 입금 예정일(매출) 및 출금 예정일(외주비/비용) 데이터를 분석하여 [Gemini AI 현금 흐름 & 자금 운용 정밀 예측 보고서]를 마크다운 형식으로 작성해 주세요.

[현재 회사 자금 & 예산 수지 데이터]:
- 총 수주 계약 금액: ${totalContractValue.toLocaleString()}원
- 누적 수금(입금완료): ${totalCollectedIncome.toLocaleString()}원 (총 입금예정: ${totalScheduledIncome.toLocaleString()}원)
- 누적 집행(출금완료): ${totalPaidExpense.toLocaleString()}원 (총 출금예정: ${totalScheduledExpense.toLocaleString()}원)
- 예상 총 순이익금: ${netExpectedProfit.toLocaleString()}원 (예상 순이익률: ${profitMarginPct.toFixed(1)}%)

[프로젝트별 예산 현황]:
${projectSummaryList.length > 0 ? projectSummaryList.join('\n') : '- 등록된 프로젝트 예산 정보 없음'}

[날짜별 입출금 스케줄 이력 (${transactionList.length}건)]:
${transactionList.length > 0 ? transactionList.join('\n') : '- 등록된 입출금 스케줄 없음'}

다음 4가지 섹션을 명확히 구분하여 전문가 수준의 마크다운 보고서를 작성해 주세요:
1. 💰 **프로젝트 수주 & 예산 손익 종합 진단 (Financial Health Overview)**
   - 수주 규모 대비 외주/비용 비율 및 총 순이익률(${profitMarginPct.toFixed(1)}%) 건전성 평가
2. 📈 **입금/출금 시점 기반 현금 흐름 예측 (Cash Flow Timeline Forecast)**
   - 입금 예정일과 출금 예정일을 고려한 월별/일별 순현금 수지 예측
3. 🚨 **자금 부족 위험 구간 & 외주비 지급 병목 진단 (Liquidity Bottleneck Risks)**
   - 입금보다 출금이 먼저 일어나는 현금 유동성 부족 위험 시점이나 외주비 미지급/지연 위험 요소 분석
4. 💡 **안정적 현금 흐름을 위한 CFO 추천 행동 가이드 (Actionable Cash Management Strategy)**
   - 선금/중도금 조기 수금 조율 전략 및 외주비 지급 시기 최적화 가이드`;

    let reportContent = '';
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;

    if (apiKey) {
      const modelsToTry = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-flash-latest'];
      for (const model of modelsToTry) {
        if (reportContent) break;
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
          const res = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
            }),
          });
          if (res.ok) {
            const data = await res.json();
            reportContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          }
        } catch (err) {
          console.warn(`Gemini AI Forecast ${model} warning:`, err);
        }
      }
    }

    if (!reportContent) {
      reportContent = `💰 **프로젝트 수주 & 예산 손익 종합 진단 (Financial Health Overview)**
- 총 수주금액: **${totalContractValue.toLocaleString()}원**
- 예정 총 비용: **${totalScheduledExpense.toLocaleString()}원**
- 예상 순이익: **${netExpectedProfit.toLocaleString()}원 (${profitMarginPct.toFixed(1)}%)**

📈 **입금/출금 시점 기반 현금 흐름 예측 (Cash Flow Timeline Forecast)**
- 누적 수금액: ${totalCollectedIncome.toLocaleString()}원
- 누적 출금액: ${totalPaidExpense.toLocaleString()}원

🚨 **자금 부족 위험 구간 & 외주비 지급 병목 진단 (Liquidity Bottleneck Risks)**
- 입금 예정일 전에 외주비 출금이 발생하는 시점을 사전에 확인하여 예비 자금을 확보하세요.

💡 **안정적 현금 흐름을 위한 CFO 추천 행동 가이드 (Actionable Cash Management Strategy)**
- [ ] 선금 및 중도금 입금 시점 재확인
- [ ] 외주비 지급 일정 조율 및 지출 모니터링`;
    }

    return NextResponse.json({
      success: true,
      report: reportContent,
      stats: {
        totalContractValue,
        totalCollectedIncome,
        totalScheduledIncome,
        totalPaidExpense,
        totalScheduledExpense,
        netExpectedProfit,
        profitMarginPct,
      },
    });
  } catch (error: any) {
    console.error('Error generating AI cash flow forecast:', error);
    return NextResponse.json({ error: '현금 흐름 예측 생성 중 오류가 발생했습니다.', details: error?.message }, { status: 500 });
  }
}
