create policy "admin and hr can update users"
on public.users
for update
using (
  exists (
    select 1
    from public.users me
    where me.id = auth.uid()
      and me.role in ('admin', 'hr')
  )
)
with check (
  exists (
    select 1
    from public.users me
    where me.id = auth.uid()
      and me.role in ('admin', 'hr')
  )
);