import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/customers/[id] - Get a single customer
export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id },
    });

    if (!customer || customer.userId !== userId) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json(customer);
  } catch (error) {
    console.error(`Error fetching customer ${id}:`, error);
    return NextResponse.json(
      { error: 'An internal server error occurred' },
      { status: 500 }
    );
  }
}

// PUT /api/customers/[id] - Update a customer
export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id },
    });

    if (!customer || customer.userId !== userId) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const { name, email, phone, company, position, cardImageUrl } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const updatedCustomer = await prisma.customer.update({
      where: { id },
      data: { name, email, phone, company, position, cardImageUrl },
    });

    return NextResponse.json(updatedCustomer);
  } catch (error) {
    console.error(`Error updating customer ${id}:`, error);
    return NextResponse.json({ error: 'An internal server error occurred' }, { status: 500 });
  }
}

// DELETE /api/customers/[id] - Delete a customer
export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id },
    });

    if (!customer || customer.userId !== userId) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    await prisma.customer.delete({
      where: { id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error(`Error deleting customer ${id}:`, error);
    return NextResponse.json({ error: 'An internal server error occurred' }, { status: 500 });
  }
}
