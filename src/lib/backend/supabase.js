// Supabase implementation of the DayOrbit data interface.
// Row Level Security in the database decides what each person can read or change.
import { createClient } from '@supabase/supabase-js';

const redirectBase = () => window.location.origin + window.location.pathname;
const toUser = (u) => ({ id: u.id, email: u.email, name: u.user_metadata?.full_name || '' });

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

function applyFilters(query, { eq = {}, neq = {}, gte = {}, lte = {}, inList = {} } = {}) {
  let q = query;
  for (const [k, v] of Object.entries(eq)) q = v === null ? q.is(k, null) : q.eq(k, v);
  for (const [k, v] of Object.entries(neq)) q = v === null ? q.not(k, 'is', null) : q.neq(k, v);
  for (const [k, v] of Object.entries(gte)) q = q.gte(k, v);
  for (const [k, v] of Object.entries(lte)) q = q.lte(k, v);
  for (const [k, v] of Object.entries(inList)) q = q.in(k, v);
  return q;
}

export function createSupabaseBackend(url, anonKey) {
  const supabase = createClient(url, anonKey, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  return {
    mode: 'supabase',
    client: supabase,

    auth: {
      async getUser() {
        const { data } = await supabase.auth.getSession();
        return data.session?.user ? toUser(data.session.user) : null;
      },
      onChange(callback) {
        const { data } = supabase.auth.onAuthStateChange((event, session) => {
          // Defer: calling Supabase inside this callback can deadlock the auth client.
          setTimeout(() => callback(event, session?.user ? toUser(session.user) : null), 0);
        });
        return () => data.subscription.unsubscribe();
      },
      async signUp({ email, password, fullName }) {
        const data = unwrap(await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName }, emailRedirectTo: redirectBase() },
        }));
        return { needsConfirmation: !data.session };
      },
      async signIn({ email, password }) {
        unwrap(await supabase.auth.signInWithPassword({ email, password }));
      },
      async signOut() {
        unwrap(await supabase.auth.signOut());
      },
      async resend(email) {
        unwrap(await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: redirectBase() } }));
      },
      async resetPassword(email) {
        unwrap(await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectBase() }));
      },
      async updatePassword(password) {
        unwrap(await supabase.auth.updateUser({ password }));
      },
    },

    async list(table, opts = {}) {
      if (Object.values(opts.inList || {}).some((v) => v.length === 0)) return [];
      let q = applyFilters(supabase.from(table).select(opts.select || '*'), opts);
      for (const [col, asc = true] of opts.order || []) q = q.order(col, { ascending: asc, nullsFirst: false });
      if (opts.limit) q = q.limit(opts.limit);
      return unwrap(await q);
    },

    async insert(table, rows) {
      const data = unwrap(await supabase.from(table).insert(rows).select());
      return Array.isArray(rows) ? data : data[0];
    },

    async update(table, match, patch) {
      return unwrap(await applyFilters(supabase.from(table).update(patch), { eq: match }).select());
    },

    async upsert(table, row, onConflict) {
      const data = unwrap(await supabase.from(table).upsert(row, { onConflict }).select());
      return data[0];
    },

    async remove(table, match, extra = {}) {
      unwrap(await applyFilters(supabase.from(table).delete(), { eq: match, ...extra }));
    },

    async rpc(name, args = {}) {
      return unwrap(await supabase.rpc(name, args));
    },

    // Live updates for shared lists (tasks, shopping). Returns an unsubscribe function.
    subscribe(table, spaceId, onChange) {
      const channel = supabase
        .channel(`${table}:${spaceId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table, filter: `space_id=eq.${spaceId}` }, () => onChange())
        .subscribe();
      return () => supabase.removeChannel(channel);
    },
  };
}
