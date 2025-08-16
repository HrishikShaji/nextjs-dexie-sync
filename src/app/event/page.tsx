import AutoResumeChat from "@/chatbot/components/AutoResume";
import AutoResumeDexie from "@/chatbot/components/AutoResumeDexie";
import ChatComponent from "@/chatbot/components/ChatComponent";
import WorkingResumableChat from "@/chatbot/components/LocalResume";
import NewAutoResume from "@/chatbot/components/NewAutoResume";

export default function Page() {
	return (
		<div className="h-screen">
			<NewAutoResume />
			{/* <AutoResumeDexie /> */}
			{/* <AutoResumeChat /> */}

		</div>
	)
}
