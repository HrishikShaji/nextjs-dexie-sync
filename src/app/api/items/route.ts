import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
	try {
		const items = await request.json();

		console.log("syncing called")
		const results = await Promise.all(
			items.map(async (item: { id: string; name: string }) => {
				try {
					const savedItem = await prisma.item.create({
						data: {
							id: item.id,
							name: item.name,
						},
					});


					return {
						id: savedItem.id,
						status: 'success'
					};
				} catch (error) {
					console.error('Error saving item:', error);
					return {
						id: item.id,
						status: 'error'
					};
				}
			})
		);
		console.log("syncing success", results)

		return NextResponse.json({
			success: true,
			results
		});
	} catch (error) {
		console.error('Sync error:', error);
		return NextResponse.json(
			{ success: false, error: 'Failed to sync items' },
			{ status: 500 }
		);
	}
}

export async function GET(request: NextRequest) {
	try {
		const items = await prisma.item.findMany({});

		return NextResponse.json(items);
	} catch (error) {
		console.error('Fetch items error:', error);
		return NextResponse.json(
			{ error: 'Failed to fetch items' },
			{ status: 500 }
		);
	}
}
