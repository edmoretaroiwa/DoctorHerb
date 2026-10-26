# DoctorHerb – deployment guide

A static website (GitHub Pages) with Supabase for login, database and photos. No build tools. Follow the steps in order and tick each one.

## Files
| File | Purpose |
|---|---|
| `index.html` | Page shell, colours, header, footer |
| `app.js` | All features: accounts, feed, post form, blur check, translation, likes, Fork & Correct voting, About page |
| `config.js` | **The only file you edit.** Your Supabase URL and key |
| `supabase.sql` | Creates tables, security rules, photo storage |
| `images/` | Put your pictures here (see `IMAGE-PROMPTS.md`) |
| `favicon.svg`, `404.html`, `.nojekyll` | Site icon, not-found page, GitHub Pages setting |

## Step 1. Create the Supabase backend (about 10 minutes)
- [ ] Sign up at supabase.com, click **New project**, choose a name (DoctorHerb), a strong database password (save it in a password manager), and the region nearest Zimbabwe (for example Europe or South Africa if offered).
- [ ] Wait until the project finishes setting up.
- [ ] Left menu **SQL Editor** > **New query**. Open `supabase.sql`, copy everything, paste, press **Run**. You should see "Success". If you see an error, run it once more only if the message says "already exists"; otherwise send me the error.
- [ ] **Project Settings > API**. Copy **Project URL** and the **anon public** key. Open `config.js` and replace `YOUR-PROJECT` and `YOUR-ANON-PUBLIC-KEY`. Save. (Never copy the `service_role` key.)
- [ ] **Authentication > URL Configuration**: Site URL = `https://edmoretaroiwa.github.io/doctorherb/`. Under Redirect URLs add the same address and `http://localhost:8000`.
- [ ] **Authentication > Providers > Email**: while testing you may switch off "Confirm email". **Switch it back on before you tell the public.**

## Step 2. Test on your computer
```
cd doctorherb
python3 -m http.server 8000
```
Open http://localhost:8000 in Chrome. Test: create an account, post a herb with a sharp photo, post again with a blurry photo (it must be refused), like it, click Fork & Correct, vote. Double-clicking `index.html` will NOT work; the server step is required.

## Step 3. Upload to GitHub
- [ ] Create an empty repository named `doctorherb` on github.com (Public, no README).
- [ ] In the project folder run:
```
git init
git add .
git commit -m "DoctorHerb first version"
git branch -M main
git remote add origin https://github.com/edmoretaroiwa/doctorherb.git
git push -u origin main
```
GitHub asks you to sign in. Use a Personal Access Token as the password if it refuses your normal password (GitHub > Settings > Developer settings > Tokens).
- [ ] For later updates: `git add .` then `git commit -m "what you changed"` then `git push`.

## Step 4. Switch on GitHub Pages
- [ ] Repository **Settings > Pages**. Source: **Deploy from a branch**. Branch: **main**, folder **/ (root)**. Save.
- [ ] After 1 to 2 minutes open https://edmoretaroiwa.github.io/doctorherb/ . Tick "Enforce HTTPS" if shown.

## Step 5. Go-live check
- [ ] Sign up with a real phone-friendly email, receive the confirmation email, sign in.
- [ ] Post, like, fork and vote from your phone on mobile data.
- [ ] Share the link on WhatsApp and check the preview picture appears (needs `images/share-preview.jpg`).
- [ ] Confirm "Confirm email" is ON in Supabase.

## If something fails
| Problem | Fix |
|---|---|
| Blank page or "Could not load herbs" | Wrong URL or key in `config.js`, or `supabase.sql` not run |
| "Photo upload failed" | The storage part of `supabase.sql` did not run; run it again |
| Sign-up email never arrives | Check spam; the free Supabase email sender is limited, so add a proper email service (SMTP) before a big launch |
| Good photos rejected as blurry | Lower `BLUR_MIN` in `config.js` (try 25) |
| Site shows old version | Hard refresh on the phone; wait 2 minutes after each push |

## Before you tell the public
- Translation: free LibreTranslate may not support Shona or Ndebele well. Posts still save with the original text; a missing translation shows a notice.
- Moderation: you need a way to remove harmful posts. For now, delete rows in Supabase **Table Editor > herbs**. Recruit trusted health workers as moderators.
- Safety: the About page and banner warn users. Consider asking a nurse or pharmacist to review those wordings.
- Supabase free plan limits storage and database size; upgrade if the site grows.
# DoctorHerb