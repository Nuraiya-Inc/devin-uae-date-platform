'use server';

import { signOut } from '@/lib/auth';

/** Server action shared by the sidebar, portal header, and account page. */
export async function signOutAction() {
  await signOut({ redirectTo: '/signin' });
}
