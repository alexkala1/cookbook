# Cook's Handbook

A place for recipes worth passing down. Start with a dish you love, check the details, and bring Heirloom to the counter when it is time to cook.

## At a glance

- [Start your cookbook](#start-your-cookbook)
- [Bring a recipe home](#bring-a-recipe-home)
- [Read and adapt a recipe](#read-and-adapt-a-recipe)
- [Cook in Kitchen Mode](#cook-in-kitchen-mode)
- [Plan dinner backwards](#plan-dinner-backwards)
- [Shop the Greek markets](#shop-the-greek-markets)
- [Keep a useful pantry](#keep-a-useful-pantry)
- [Cook for your guests](#cook-for-your-guests)
- [Keep the memory](#keep-the-memory)
- [Privacy and your AI keys](#privacy-and-your-ai-keys)
- [Host your own cookbook](#host-your-own-cookbook)
- [When something does not work](#when-something-does-not-work)

## Start your cookbook

Open **Recipes**. An empty, unfiltered collection offers **🌱 Load Starter Heirloom Recipes**. Select it once and wait for the five recipe cards to appear. No AI account or key is needed.

| Recipe | Bring it to the table as | Try this feature |
| --- | --- | --- |
| Arni me Patates | Main: lamb shoulder with lemon potatoes | Oven guidance, a 74°C internal-temperature target, and tenderness cues |
| Traditional Spanakopita | Appetizer: spinach, feta and homemade phyllo | Advance preparation, pastry science, and equipment alternatives |
| Santorini Fava | Side: yellow split-pea purée | Texture milestones and gentle simmering |
| Classic Fasolada | Main: white bean soup | The overnight soak and a long cooking schedule |
| Revani with Citrus Syrup | Dessert: semolina and yogurt cake | Syrup temperature, absorption, and resting time |

The pack loads only when there are **zero saved recipes**. Repeating the action does not duplicate the pack or overwrite a family recipe. If the button is missing, clear search, type and Favorites filters. A populated cookbook cannot load this starter pack through the first-run action.

Prefer to begin with your own dish? Choose **+ New Recipe** and enter the ingredients, numbered steps and equipment. Add sensory notes and family memories as you go. You can edit a starter recipe just like any other recipe.

Before cooking, open **Settings → Your kitchen hardware**. Select your stove, oven, available tools and preferred salt, then save. These choices make the cooking guidance more useful.

## Bring a recipe home

Choose **Import Recipe** from your collection. Select a source, generate a draft, read the progress messages, and review the editable result before choosing **Save to Cookbook**. A generated draft is not saved automatically. Cancel stops an import in progress.

### Web URL

Paste a public recipe-page address. Heirloom first looks for structured recipe metadata, often called Recipe JSON-LD. This can preserve the published ingredients, instructions, servings, times and image. If suitable metadata is absent, Heirloom extracts page text and asks the selected model to organize it.

Pages behind a login, paywall or bot challenge may not work. Localhost, private-network addresses, unsafe protocols and unsafe redirects are blocked. Use **Conversational Memory** to paste the relevant recipe text when a site cannot be read. Do not paste account credentials or private access links.

### Notes and conversational memory

Use **Conversational Memory** for unstructured notes, a copied transcript, or a remembered dish. Include what you know and identify what you do not:

> Yiayia roasted lamb shoulder with potatoes, lemon and oregano. Six people ate together. The pan was covered first, then uncovered to brown. I do not remember the quantities.

Known quantities should be preserved. Inferred measurements are marked **[Inferred by AI]** in ingredient notes, with a ratio explanation where available. Check every inferred amount, especially salt, raising agents, liquids and serving size. Without a live model, the app can offer a labeled deterministic draft; this is a starting template, not a recovered family original.

### Video Link

Paste a YouTube URL or video ID. Heirloom tries accessible captions, then the video's description. It does not watch the footage or transcribe arbitrary audio. If neither captions nor a useful description is accessible, copy your own notes into **Conversational Memory**. Review transcript errors such as “fifteen” becoming “fifty.”

### What the import defenses do

A source can contain text such as “ignore previous instructions.” That is a **prompt injection attempt**, not a cooking instruction. Heirloom tells the model to treat source text as untrusted data and validates the returned recipe structure. URL fetching also applies network restrictions. These defenses reduce risk; they cannot guarantee that an AI draft is correct or that malicious instructions never influence it.

Do not follow requests inside imported text to reveal keys, run commands, or visit unrelated sites. Review the draft for unexpected links, ingredients, quantities and unsafe directions. Progress messages describe processing stages; they are not a transcript of a model's private reasoning.

## Read and adapt a recipe

Open a recipe card to see its ingredients, equipment, method and heirloom notes.

- Change **Servings** to scale ingredient quantities. Scaling a recipe does not prove that cooking time scales with it.
- Choose **Metric** or **US** measures. Mass and volume are different: the app cannot invent an ingredient's density to convert every cup into grams.
- For salt, set **Salt used in the recipe** and **Salt you are using**. Volume substitutions preserve salt mass only when the original salt is known. An unknown original is left unconverted. Weighed salt stays unchanged, and seasoned salts are excluded.
- Use **Ask AI for Substitution** beside an ingredient for alternatives and moisture or texture adjustments. Recheck suitability for every guest; a suggested replacement may introduce another allergen.
- Mark a favorite to find it quickly. Edit inaccurate import details before cooking.

**Food Science Why** explains the method. **Sensory Milestones** describe appearance, sound, aroma or texture. An internal-temperature target is shown when present. Sensory cues help judge progress; they are not proof of food safety.

## Cook in Kitchen Mode

Select **Start cooking**. The large current-step text, progress indicator and fixed **Prev / Next** controls keep the method within reach. The ingredient panel shows names mentioned in the current step; if no explicit match is found, it shows the recipe's ingredients. This matching is a convenience, not a complete mise-en-place checklist.

### Touch, air waves and keys

**Touch swipe:** swipe left across the step to advance; swipe right to go back. This uses the app's touch-swipe handling (`useSwipe`). Vertical scrolling remains available, and interacting with controls does not intentionally advance a step.

**Hands-free air wave:** choose **Enable camera gestures**, allow camera access, and keep the device still. Wave left for next and right for previous. Good lighting and an uncluttered background help. The camera detects motion; it does not recognize a specific hand or use MediaPipe. Moving people can trigger it.

Camera frames are processed on your device, with no frames sent to Heirloom's server. Turning the camera off, leaving Kitchen Mode or hiding the page stops its tracks. Re-enable it when returning if needed. Camera access generally requires localhost or HTTPS and browser permission.

**Keyboard:** ArrowLeft goes back; ArrowRight or Space advances when you are not editing a field or using an interactive control. The visible buttons remain available if gesture detection is unreliable.

### Keep the screen awake

Check the wake-lock badge. **Screen awake · active** means the browser currently holds the lock. Use **Keep screen awake** to request it again or **Allow screen sleep** to release it. Browser support, power-saving settings and backgrounding can interrupt wake lock; check the badge after returning to the page.

### Run several timers

1. Read the step and choose a **Start Timer** button for a detected interval. A step can offer more than one interval.
2. Start other timers as you move through the recipe. Each has its own name and controls.
3. Use **Pause / Resume**, **Reset**, or **Remove** as needed. Reset returns that timer to its original duration.
4. If removed accidentally, select **Undo** within **five seconds**. A running timer keeps its original deadline; Undo does not grant extra cooking time.
5. Select **Enable sound** to allow the synthesized chime. A finished timer also produces a visible alert. Swipe the alert down to dismiss it without stopping other timers.

Timer deadlines survive a reload in the same browser tab when session storage is available. Closing the tab, changing browser or clearing storage is different from reloading. Browsers may delay background audio and execution; use a separate alarm for anything you cannot afford to miss. Leaving with running timers prompts for confirmation.

### Match the heat to your kitchen

When a step contains a recognized oven temperature, confirm **Recipe oven** and **Your oven**. Choose one adjustment:

| Adjustment | Conventional → fan | Fan → conventional |
| --- | --- | --- |
| Temperature | Lower by 20°C, or 25°F when using Fahrenheit | Raise by the corresponding offset |
| Time only | Keep the setting; use 80% of the original time | Keep the setting; divide the time by 0.8 |

For example, 190°C conventional becomes 170°C fan under the temperature strategy. The Celsius and Fahrenheit rules are separate cooking approximations. Do not apply both time and temperature reductions, or repeat a conversion your oven already performs. Low-temperature cases can retain the original setting with a caution. If a step contains several durations, choose the oven interval before applying a time adjustment. Internal food-temperature targets are not reduced.

Burner notes use your saved stove profile: gas changes flame quickly while the pan retains heat; induction heats rapidly, so start below boost; radiant electric retains heat, so lower power early or move the pan when needed. These are practical guidance, not remote appliance controls or calibrated power settings.

### Rescue a dish

Open **Rescue** from the Kitchen header. Choose the closest problem for immediate offline triage: split emulsion, too salty, scorched base, steaming instead of searing, or a dish that is too acidic, spicy, bitter or sweet.

Read the first action before continuing. The drawer explains why the adjustment helps: for example, dilute excess salt rather than relying on a potato to selectively remove it, or transfer food away from a scorched base without scraping it into the new pot. For a custom problem, describe the dish, amounts and what happened; configured BYOK models can help, with an offline fallback available.

Rescue is for culinary troubleshooting. It cannot establish that spoiled food, an allergen exposure or an unsafe cooking process has become safe.

## Plan dinner backwards

Open **Dinner** and select recipes for your courses. Set the target serving time, available burners and ovens, and the month. Optionally set guest count and individual course serving times. Build the schedule.

The conductor works backwards from serving times using the recipe steps and estimated durations. Read the earliest tasks before committing to the plan: an overnight bean soak belongs on the previous day. Missing or inaccurate recipe times produce an inaccurate schedule.

Review **Equipment conflicts** before you begin. An oven clash or burner overload includes possible resolutions. Move a course's serving time, prepare a dish ahead, or choose equipment you actually have, then rebuild. Conflict warnings are not an automatic rescheduling guarantee. Changing the inputs clears the old plan, and progress checkmarks are for the current displayed plan.

For a starter-pack dinner, consider spanakopita, lamb with fava, then revani. Make the syrup cake ahead; inspect whether the pastry and roast need the oven together. Check the seasonal advice for your selected month, and remember that local availability can differ.

The Dinner page does not automatically run the guest audit. Check the same menu in **Guests** before buying ingredients.

## Shop the Greek markets

Heirloom's grocery engine groups compatible quantities across a menu and routes recognized ingredients to Greek shopping destinations:

| Destination | Typical items |
| --- | --- |
| Laiki market · Λαϊκή Αγορά | Fresh vegetables, fruit and herbs |
| Butcher · Χασάπης | Meat, with Greek counter phrases for recognized cuts and preparation |
| Bakery · Φούρνος | Bread and recognized bakery supplies |
| Supermarket · Σούπερ μάρκετ | Dairy, dry goods, packaged ingredients and unrecognized items |

The result can include package-size suggestions, surplus ideas and advance-prep alerts. Review the units and notes: unlike measures remain separate when a density is unknown. These are shopping categories, not live stock checks, map directions or opening hours. Routing currently targets Greek markets and **does not subtract pantry stock**.

**Current access:** grouped grocery generation is an API feature; there is no grocery-generation button on the Dinner page yet. A self-hosting user can obtain recipe IDs from the address of each recipe and request a list with the following command. Replace `RECIPE_ID` and keep the Origin header identical to your server origin. Each request saves a new grocery list.

```sh
curl --fail-with-body http://localhost:3000/api/grocery/generate \
  -H 'Origin: http://localhost:3000' \
  -H 'Content-Type: application/json' \
  --data '{"recipeIds":["RECIPE_ID"],"servings":6}'
```

Without API access, use the recipe ingredient lists and the destination table above to prepare your shopping list manually.

## Keep a useful pantry

Open **Pantry** and add the name, quantity, unit, storage location and optional expiry date. Filter by **All**, **Fridge**, **Freezer** or **Pantry**. Dated items are ordered soonest first; an item without an expiry date is not assumed to stay fresh indefinitely.

Adding the same normalized name in the same location merges quantities when units can be converted. Incompatible units produce an error; use the existing unit. The earliest known expiry is retained, so check actual batches before combining them.

Paste receipt text, including text copied from an OCR app, into the receipt field. Parse it, review the proposed quantities and inferred storage locations, then add the reviewed items. This is a text parser, not an image-scanning camera. A receipt does not establish a food's expiry date.

Choose **Cook With What I Have** to rank saved recipes by ingredient completeness. Read the explicit in-stock and missing lists; matching considers stock quantities and compatible units, and excludes expired entries. A high match percentage does not check guest suitability or guarantee that every ingredient name was recognized.

### After cooking: stock is not deducted automatically

**The current Done action leaves Kitchen Mode; it does not subtract ingredients from the pantry.** There is no automatic cook-completion deduction in this release. Keep inventory current yourself: remove a used-up item, or remove its old entry and re-add the remaining quantity, preserving its location and expiry date. Adding the remainder without removing the old entry would increase stock instead.

For example, if you used 300 g from 500 g of split peas, replace that pantry entry with 200 g. Do this once after cooking, based on what you actually used rather than the original recipe's serving count.

## Cook for your guests

Open **Guests** and add a profile with allergies, dietary restrictions, dislikes and notes. Confirm the information with the person eating; a saved profile can become out of date. Extra allergy or restriction text may produce a manual-review warning when it is outside the supported checks.

In **Check a meal for your guests**, select the attending guests and planned recipes, then choose **Audit meal**. The checker compares ingredient names across the selected menu and profiles. It supports up to 20 guests and 20 recipes per audit.

| Result | What to do |
| --- | --- |
| Critical allergen | Review the flagged ingredient with the guest; use a suitable alternative or choose a different dish |
| Dietary conflict | Check the ingredient and preparation against the person's requirements |
| Dislike warning | Discuss an omission, substitution or another course |
| Review warning | Check the unknown or unsupported case manually |

The audit covers recognized allergens and dietary patterns such as vegetarian, vegan, halal, kosher and pregnancy-related ingredient concerns. It does not verify certification, preparation history, ingredient labels or cross-contact. **No detected conflicts is not a safety certificate.**

Read the cross-contact advice and substitution suggestions. Check packaged ingredient labels and the substitute itself; do not assume “plant-based” or “gluten-free” answers every allergy. Keep the guest's requirements in view when using shared utensils, pans or serving dishes. Rerun the audit after changing a recipe or profile. The check is advisory and does not prevent you from starting an unsuitable recipe.

## Keep the memory

After dinner, open the recipe's **Tasting notes & family keepsakes**. Record the cook date, optional rating, what you would change, and the occasion: “Cooked for Yiayia's birthday” can matter as much as the timing adjustment.

Choose **Print heirloom card** for the vintage recipe view, then print or save as PDF using your browser. Inspect print preview for your paper size. The card carries the recipe's method and sensory guidance; the keepsake form remains the place to record each cooking occasion.

## Privacy and your AI keys

Your cookbook, pantry, guest profiles and keepsakes live in the self-hosted SQLite database. They are personal data; protect the server and its backups.

In **Settings → Your AI providers**, enter a supported model ID, choose OpenAI, Anthropic, Gemini, Groq or Ollama, and save. Cloud providers require your own key. Ollama can use a selected local model without a key. If a cloud key is present but the model is missing, choose a model before retrying.

Keys are stored **unencrypted in this browser's localStorage**. Anyone with access to that browser profile can read them. They are sent in request headers to Heirloom and on to the chosen provider when used; the server is designed not to save or log them. **Clear saved keys** removes the app's saved configuration from that browser. It does not revoke a key at its provider.

When a live model is used, source text and relevant request content leave Heirloom for that provider. Provider retention and charges follow your account's terms. With no live key, structured recipe metadata and labeled offline fallbacks can still work; fetching a URL or video still needs network access. Camera frames stay on-device.

The PWA can retain previously visited pages and selected read responses, including personal data, for offline use. Mutations and AI/BYOK calls are not queued or cached as offline work. Cached reads may be stale. On a shared device, clear the site's browser storage as well as saved keys. Installation and service-worker features require HTTPS or localhost. Updates offer **Reload** or **Later** outside Kitchen Mode.

## Host your own cookbook

The repository uses Nuxt 4, Nitro and SQLite, with a Node.js 24 Docker image. Install Docker with Compose, open a terminal in the checkout, and prepare the persistent directory:

```sh
docker compose build
mkdir -p data
# Linux: allow the container's node user to write this directory.
sudo chown 1000:1000 data
chmod 700 data
docker compose up -d --wait
docker compose ps
```

Open **http://localhost:3000**. The container runs as a non-root user. Compose maps `./data` to `/app/data`, and the database path is `/app/data/heirloom.db`. Startup applies migrations; the healthcheck requests the kitchen endpoint. Container replacement preserves the bind-mounted directory. Never run multiple replicas against this SQLite directory.

If using rootless Docker or user-namespace remapping, adjust ownership for the mapped user. Compose intentionally refuses to create a missing bind directory for you. For another local port, set `HEIRLOOM_PORT` before starting and use the same value on later Compose commands.

There is **no multiuser login**. The default port is published only on the host's loopback interface. For remote use, an SSH tunnel keeps that boundary:

```sh
ssh -L 3000:127.0.0.1:3000 user@your-server
```

Then open localhost:3000 in your own browser. `HEIRLOOM_PUBLIC_HOST` adjusts the Host allowlist only; it does not add authentication. The current origin checks do not support a TLS-terminating reverse proxy out of the box. Do not disable them to expose the service. Ollama targets the server's loopback address; inside Docker, that means the container, not your host's Ollama installation.

### Back up before updating

Stop the app before copying SQLite files. Keep the full data directory, including any WAL files, and store the archive outside `data` with appropriate access restrictions.

```sh
docker compose stop
tar -czf "heirloom-backup-$(date +%Y%m%d-%H%M%S).tar.gz" data
# Update the checkout and review migration changes before rebuilding.
docker compose build --pull
docker compose up -d --wait
```

To restore, stop the app, move the current data directory aside, extract a chosen backup, restore write permissions and start a compatible image. Keep the matching application version with your backup; an older version may not understand newer migrations. Browser keys and session timers are not part of a SQLite backup.

## When something does not work

| Symptom | Next action |
| --- | --- |
| Starter button is absent | Clear recipe filters; check whether the cookbook already contains a recipe |
| Import cannot read a page or video | Paste the relevant notes into Conversational Memory |
| AI asks for a model | Save a supported model ID with the selected provider in Settings |
| Draft seems generic | Check whether it is labeled as an offline fallback, then edit it or configure a live provider |
| Camera or wake lock is unavailable | Check permissions and secure context; use the visible controls and device screen settings |
| Timer makes no sound | Select Enable sound, check device volume, and keep the page foregrounded |
| Dinner cannot fit the equipment | Review the flagged overlap, change course times or preparation, and rebuild |
| Pantry amount is wrong after dinner | Update it manually; cooking completion does not deduct stock |
| Save fails while offline | Reconnect and retry; offline writes are not queued |
| Docker will not start | Check `docker compose logs --tail=100 heirloom`, the data directory and write permissions |

Keep the recipe accurate, check the plan before heating the pan, and record what worked for the next cook.
