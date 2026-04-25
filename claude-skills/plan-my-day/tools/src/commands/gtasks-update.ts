import { getAccessToken } from "@gwynj/google-oauth";
import { parseArgs, requireArg, optArg } from "../args.js";

async function tasksPatch(
  token: string,
  path: string,
  body: Record<string, string>,
): Promise<void> {
  const res = await fetch(`https://tasks.googleapis.com/tasks/v1${path}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok)
    throw new Error(
      `Tasks API ${res.status} on PATCH ${path}: ${await res.text()}`,
    );
}

export async function gtasksUpdate(argv: string[]): Promise<string> {
  const { named } = parseArgs(argv);
  const id = requireArg(named, "id");
  const taskList = optArg(named, "task-list") ?? "@default";
  const title = optArg(named, "title");
  const due = optArg(named, "due"); // YYYY-MM-DD
  const status = optArg(named, "status"); // needsAction | completed

  if (!title && !due && !status)
    throw new Error("Provide at least one of: --title, --due, --status");

  const body: Record<string, string> = {};
  if (title) body["title"] = title;
  if (due) body["due"] = `${due}T00:00:00.000Z`;
  if (status) body["status"] = status;

  const token = await getAccessToken("tasks");
  await tasksPatch(token, `/lists/${taskList}/tasks/${id}`, body);

  const parts = [
    title ? `title="${title}"` : null,
    due ? `due=${due}` : null,
    status ? `status=${status}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  return `Updated Google Task ${id}: ${parts}`;
}
