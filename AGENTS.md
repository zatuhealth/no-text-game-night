<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Project rules

- Online matches: rooms are publicly readable, but every write goes through server functions in `src/lib/rooms.functions.ts` using a per-browser player token; hidden picks and tokens live in tables with no public access, so the keeper can't see the striker's choice before resolving.
- Shootout scoring rules live in `src/lib/shootout.ts` (pure, tested in `src/test/shootout.test.ts`) so client and server agree on the result.
