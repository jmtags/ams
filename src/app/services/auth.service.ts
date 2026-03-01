import { supabase } from '../lib/supabase';
import type { LoginCredentials } from '../lib/types';

export const authService = {
  async login(credentials: LoginCredentials) {
    // 1️⃣ Authenticate
    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) throw error;
    if (!data.user) throw new Error('No user returned');

    // 2️⃣ Fetch full user record from your users table
    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (userError) throw userError;

    return userRecord; // 🔥 return full user with role
  },

  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getCurrentUser() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;

    const { data: userRecord } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    return userRecord;
  },
};
