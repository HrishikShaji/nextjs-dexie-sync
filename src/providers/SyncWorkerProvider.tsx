"use client"
import { ReactNode, useEffect, useRef } from "react";

interface Props {
	children: ReactNode
}

export default function SyncWorkerProvider({ children }: Props) {
	const workerRef = useRef<Worker>(null)
	useEffect(() => {
		const worker = new Worker(new URL('../worker/modified-worker.ts', import.meta.url));
		workerRef.current = worker
		console.log(workerRef.current)
		return () => {
			if (workerRef.current) {
				workerRef.current.terminate();
			}
		};
	}, [])

	return (
		<>
			{children}
		</>
	)
}
