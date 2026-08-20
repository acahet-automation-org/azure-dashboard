import "dotenv/config";
import axios from "axios";
const auth = Buffer.from(`:${process.env.AZDO_PAT}`).toString("base64");
const base = `https://dev.azure.com/${process.env.AZDO_ORG}/${encodeURIComponent(process.env.AZDO_PROJECT)}/_apis`;
try {
    const r = await axios.post(
        `${base}/wit/wiql?api-version=7.1`,
        { query: "SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = 'Bug'" },
        { headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" }, timeout: 30000 }
    );
    console.log("HTTP 200 OK");
    console.log("workItems count:", r.data.workItems?.length ?? "undefined");
    if (r.data.workItems?.length > 0) console.log("first 3:", JSON.stringify(r.data.workItems.slice(0,3)));
    else console.log("raw response:", JSON.stringify(r.data).slice(0,500));
} catch(e) {
    console.error("status:", e.response?.status);
    console.error("body:", JSON.stringify(e.response?.data).slice(0,500));
}
