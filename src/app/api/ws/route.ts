import { NextRequest } from 'next/server';
import { WebSocketServer } from 'ws';

let wss: WebSocketServer | null = null;

export async function GET(request: NextRequest) {
	// Create WebSocket server if it doesn't exist
	if (!wss) {
		wss = new WebSocketServer({ port: 8080 });

		wss.on('connection', (ws) => {
			console.log('Client connected');

			// Send welcome message
			ws.send(JSON.stringify({
				type: 'welcome',
				message: 'Connected to WebSocket server!'
			}));

			// Handle incoming messages
			ws.on('message', (data) => {
				try {
					const message = JSON.parse(data.toString());
					console.log('Received:', message);

					// Echo the message back to all connected clients
					wss?.clients.forEach((client) => {
						if (client.readyState === client.OPEN) {
							client.send(JSON.stringify({
								type: 'message',
								data: message,
								timestamp: new Date().toISOString()
							}));
						}
					});
				} catch (error) {
					console.error('Error parsing message:', error);
				}
			});

			// Handle client disconnect
			ws.on('close', () => {
				console.log('Client disconnected');
			});
		});
	}

	return new Response('WebSocket server running on port 8080', { status: 200 });
}
