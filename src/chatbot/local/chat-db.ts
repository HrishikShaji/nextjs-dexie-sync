import Dexie from "dexie";
import { LocalConversation } from "../types/chat.type";

interface MyDatabase extends Dexie {
	conversations: Dexie.Table<LocalConversation, string>;
	deleteQueue: Dexie.Table<{ id: string; syncStatus: "pending" | "synced" | "error" }, string>;
}


const chatDB = new Dexie("HrishixDB") as MyDatabase;

chatDB.version(3).stores({
	conversations: "id,title,messages,syncStatus",
	deleteQueue: "id,syncStatus"
});

export default chatDB;
