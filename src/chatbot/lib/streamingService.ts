export interface StreamingCallbacks {
	onStart?: () => void;
	onContent: (content: string) => void;
	onComplete: () => void;
	onError: (error: string) => void;
}

export async function streamChatResponse(
	messages: Array<{ role: string; content: string }>,
	conversationId: string,
	callbacks: StreamingCallbacks
) {
	try {
		callbacks.onStart?.();

		const response = await fetch('http://localhost:3001/api/chat/stream', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				messages,
				conversationId,
			}),
		});

		if (!response.ok) {
			throw new Error(`Server error: ${response.status}`);
		}

		const reader = response.body?.getReader();
		if (!reader) {
			throw new Error('No response body');
		}

		const decoder = new TextDecoder();

		while (true) {
			const { done, value } = await reader.read();

			if (done) break;

			const chunk = decoder.decode(value);
			const lines = chunk.split('\n');

			for (const line of lines) {
				if (line.startsWith('data: ')) {
					const data = line.slice(6).trim();

					if (!data) continue;

					try {
						const parsed = JSON.parse(data);

						switch (parsed.type) {
							case 'content':
								callbacks.onContent(parsed.content);
								break;
							case 'done':
								callbacks.onComplete();
								return;
							case 'error':
								callbacks.onError(parsed.error);
								return;
						}
					} catch (e) {
						console.warn('Failed to parse streaming data:', data);
					}
				}
			}
		}

		callbacks.onComplete();
	} catch (error) {
		callbacks.onError(error instanceof Error ? error.message : 'Unknown error');
	}
}
