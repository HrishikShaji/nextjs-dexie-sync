import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
	try {
		const { id } = await request.json();

		await prisma.item.delete({
			where: { id }
		});

		console.log(`Deleting item with ID: ${id}`);

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('Delete error:', error);
		return NextResponse.json(
			{ success: false, error: 'Failed to delete item' },
			{ status: 500 }
		);
	}
}
