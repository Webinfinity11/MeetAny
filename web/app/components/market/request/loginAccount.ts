import type { Store } from "../../../lib/market-client";

export async function loginAccount(store: Store, email: string, password: string) {
  try {
    await store.login(email.trim(), password);
  } catch (error) {
    if ((error as { userMessage?: string })?.userMessage === "პაროლი არასწორია.") {
      throw { userMessage: "ელფოსტა ან პაროლი არასწორია." };
    }
    throw error;
  } finally {
    window.dispatchEvent(new Event("meetany:auth"));
  }
}
