import { LocalConversation } from '@/chatbot/types/chat.type';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
	try {
		const items = await request.json();

		console.log("syncing called", items)
		const results = await Promise.all(
			items.map(async (item: LocalConversation) => {
				try {
					const savedConversation = await prisma.conversation.create({
						data: {
							id: item.id,
							title: item.title,
						},
					});


					return {
						id: savedConversation.id,
						status: 'success'
					};
				} catch (error) {
					console.error(`Error saving item:${JSON.stringify(item)}`, error);
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
			{ success: false, error: 'Failed to sync conversations' },
			{ status: 500 }
		);
	}
}

export async function DELETE(request: NextRequest) {
	try {
		const items = await request.json();

		console.log("delete syncing called", items)
		const results = await Promise.all(
			items.map(async (id: string) => {
				try {
					const deletedItem = await prisma.conversation.delete({ where: { id } })


					return {
						id: deletedItem.id,
						status: 'success'
					};
				} catch (error) {
					console.error('Error deleting conversation:', error);
					return {
						id,
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
			{ success: false, error: 'Failed to sync conversations' },
			{ status: 500 }
		);
	}
}

