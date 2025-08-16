import AutoResumeChat from "@/chatbot/components/AutoResume";
import AutoResumeDexie from "@/chatbot/components/AutoResumeDexie";
import ChatComponent from "@/chatbot/components/ChatComponent";
import WorkingResumableChat from "@/chatbot/components/LocalResume";

export default function Page() {
	return (
		<div className="h-screen">
			<AutoResumeDexie />
			{/* <AutoResumeChat /> */}

		</div>
	)
}
