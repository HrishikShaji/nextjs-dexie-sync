import Dexie from "dexie";
import { LocalConversation } from "../types/chat.type";

interface MyDatabase extends Dexie {
	conversations: Dexie.Table<LocalConversation, string>;
}


const chatDB = new Dexie("HrishixDB") as MyDatabase;

chatDB.version(3).stores({
	conversations: "id,title,messages,syncStatus",
});

export default chatDB;
