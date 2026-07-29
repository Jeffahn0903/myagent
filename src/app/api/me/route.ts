import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';

export async function GET(request: Request) {
    try {
        const userId = getUserIdFromRequest(request);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                googleAccessToken: true, // Specifically, to check if it exists
            }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        
        // Don't send the full token, just whether it's present
        const userData = {
            ...user,
            hasGoogleAuth: !!user.googleAccessToken
        };
        // @ts-ignore
        delete userData.googleAccessToken;


        return NextResponse.json(userData);

    } catch (error) {
        console.error('Error fetching user data:', error);
        return NextResponse.json(
            { error: 'An internal server error occurred' },
            { status: 500 }
        );
    }
}
