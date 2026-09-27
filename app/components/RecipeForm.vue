<script setup lang="ts">
import type { RecipeDetail } from '../../shared/types/recipe'
import type { RecipeInput } from '../../server/utils/validation'
import { saltDensities, saltLabels } from '../utils/units'
import { isPlaceholderIngredients, parseStructuredRecipe, splitNotesUpdate, stepCountPhrase } from '#shared/culinary/structured-recipe'

const props = defineProps<{ recipe?: RecipeDetail }>()
const emit = defineEmits<{ saved: [recipe: RecipeDetail]; cancel: [] }>()
const r = props.recipe
const form = reactive({
  title: r?.title ?? '',
  description: r?.description ?? '',
  recipeType: r?.recipeType ?? 'food',
  servings: r?.servings ?? 4,
  originalSaltType: r?.originalSaltType ?? null,
  prepTimeMinutes: r?.prepTimeMinutes ?? 15,
  cookTimeMinutes: r?.cookTimeMinutes ?? 30,
  difficulty: r?.difficulty ?? 'intermediate',
  cuisine: r?.cuisine ?? '',
  imageUrl: r?.imageUrl ?? '',
  heirloomNotes: r?.heirloomNotes ?? '',
  ingredients: r?.ingredients.map(({ id, recipeId, ...row }) => row) ?? [
    { name: '', amount: 1, unit: 'g', gramsEquivalent: null, category: 'pantry', notes: '', sortOrder: 0 }
  ],
  steps: r?.steps.map(({ id, recipeId, ...row }) => row) ?? [],
  equipment: r?.equipment.map(({ id, recipeId, ...row }) => row) ?? []
})

const saving = ref(false)
const error = ref('')
const { state, label } = useActionFeedback(saving, error)
const issues = ref<{ path: string; message: string }[]>([])

function fieldIssue(path: string) {
  return issues.value.some(issue => issue.path === path)
    ? { 'aria-invalid': 'true' as const, 'aria-describedby': 'issue-' + path.replaceAll('.', '-') }
    : {}
}

// A numbered method pasted or imported into the notes can become real, editable steps.
const notesPlan = computed(() => parseStructuredRecipe(form.heirloomNotes, form.servings))
const canSplit = computed(() => !!notesPlan.value && notesPlan.value.steps.length > form.steps.length)
const replacesIngredients = computed(() => !!notesPlan.value?.ingredients.length && (!form.ingredients.some(row => row.name.trim()) || isPlaceholderIngredients(form.ingredients)))
type SplitBackup = Pick<typeof form, 'steps' | 'ingredients' | 'heirloomNotes' | 'description' | 'cookTimeMinutes'>
const splitBackup = ref<SplitBackup | null>(null)
const splitSummary = ref('')

function splitNotes() {
  const plan = notesPlan.value
  if (!plan) return
  splitBackup.value = JSON.parse(JSON.stringify(toRaw({ steps: form.steps, ingredients: form.ingredients, heirloomNotes: form.heirloomNotes, description: form.description, cookTimeMinutes: form.cookTimeMinutes })))
  const current = form.ingredients.some(row => row.name.trim()) ? form.ingredients : []
  const update = splitNotesUpdate({ title: form.title, description: form.description, prepTimeMinutes: form.prepTimeMinutes, ingredients: current, steps: form.steps }, plan)
  form.steps = update.steps.map((step, index) => ({
    stepNumber: index + 1,
    instruction: step.instruction,
    durationMinutes: step.durationMinutes ?? null,
    timerRequired: step.timerRequired ?? false,
    heatLevel: step.heatLevel ?? 'none',
    scienceWhy: step.scienceWhy ?? '',
    failurePrevention: step.failurePrevention ?? '',
    sensoryVisual: step.sensoryVisual ?? '',
    sensoryAudio: step.sensoryAudio ?? '',
    sensoryAroma: step.sensoryAroma ?? '',
    sensoryTexture: step.sensoryTexture ?? '',
    internalTempTargetC: step.internalTempTargetC ?? null,
    sortOrder: index
  }))
  if (update.ingredients) {
    form.ingredients = update.ingredients.map((row, index) => ({ name: row.name, amount: row.amount, unit: row.unit, gramsEquivalent: null, category: 'pantry', notes: row.notes ?? '', sortOrder: index }))
  }
  form.heirloomNotes = update.heirloomNotes
  if (update.description) form.description = update.description
  if (update.cookTimeMinutes) form.cookTimeMinutes = update.cookTimeMinutes
  splitSummary.value = `Split into ${update.steps.length} steps` + (update.ingredients ? ` and ${update.ingredients.length} ingredients` : '') + '. Review them, then save the recipe.'
}

function undoSplit() {
  if (!splitBackup.value) return
  Object.assign(form, splitBackup.value)
  splitBackup.value = null
  splitSummary.value = ''
}

function addStep() {
  form.steps.push({
    stepNumber: form.steps.length + 1,
    instruction: '',
    durationMinutes: null,
    timerRequired: false,
    heatLevel: 'none',
    scienceWhy: '',
    failurePrevention: '',
    sensoryVisual: '',
    sensoryAudio: '',
    sensoryAroma: '',
    sensoryTexture: '',
    internalTempTargetC: null,
    sortOrder: form.steps.length
  })
}

async function save() {
  if (saving.value) return
  saving.value = true
  error.value = ''
  issues.value = []
  const body: RecipeInput = {
    ...form,
    cuisine: form.cuisine.trim() || null,
    imageUrl: form.imageUrl.trim() || null,
    ingredients: form.ingredients.map((row, index) => ({ ...row, sortOrder: index })),
    steps: form.steps.map((row, index) => ({ ...row, stepNumber: index + 1, sortOrder: index }))
  }

  try {
    const saved = await $fetch<RecipeDetail>(r ? '/api/recipes/' + r.id : '/api/recipes', {
      method: r ? 'PUT' : 'POST',
      body
    })

    emit('saved', saved)
    if (!r) await navigateTo('/recipes/' + saved.id)
  } catch (cause) {
    const failure = cause as { data?: { data?: { issues?: { path: string; message: string }[] } } }
    issues.value = failure.data?.data?.issues ?? []
    error.value = 'Your recipe wasn’t saved. Check the fields below and try again.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form class="mt-10 max-w-4xl space-y-10" @submit.prevent="save">
    <fieldset :disabled="saving" class="space-y-6">
      <legend class="form-legend">The essentials</legend>
      <label class="block">Recipe title<input
          v-model="form.title"
          v-bind="fieldIssue('title')"
          class="field mt-2"
          required
          maxlength="200"
      /></label>
      <label class="block">Description<textarea
          v-model="form.description"
          v-bind="fieldIssue('description')"
          class="field mt-2"
          rows="3"
          maxlength="10000"
        />
      </label>
      <div class="form-grid">
        <label>Recipe type<select
            v-model="form.recipeType"
            v-bind="fieldIssue('recipeType')"
            aria-label="Recipe type"
            class="field mt-2"
          >
            <option value="food">Food</option>
            <option value="drink">Drink</option>
            <option value="cocktail">Cocktail</option>
            <option value="baking">Baking</option>
            <option value="dessert">Dessert</option>
          </select></label>
        <label>Difficulty<select
            v-model="form.difficulty"
            v-bind="fieldIssue('difficulty')"
            aria-label="Difficulty"
            class="field mt-2"
          >
            <option value="easy">Easy</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
            <option value="master">Master</option>
          </select></label>
        <label>Servings<input
            v-model.number="form.servings"
            v-bind="fieldIssue('servings')"
            type="number"
            min="1"
            max="1000"
            required
            class="field mt-2"
        /></label>
        <label>Cuisine<input v-model="form.cuisine" v-bind="fieldIssue('cuisine')" maxlength="200" class="field mt-2"
        /></label>
        <label>Prep time (minutes)<input
            v-model.number="form.prepTimeMinutes"
            v-bind="fieldIssue('prepTimeMinutes')"
            type="number"
            min="0"
            max="100000"
            required
            class="field mt-2"
        /></label>
        <label>Cook time (minutes)<input
            v-model.number="form.cookTimeMinutes"
            v-bind="fieldIssue('cookTimeMinutes')"
            type="number"
            min="0"
            max="100000"
            required
            class="field mt-2"
        /></label>
      </div>
      <label class="block">Original salt type<select
          v-model="form.originalSaltType"
          v-bind="fieldIssue('originalSaltType')"
          aria-label="Original salt type"
          class="field mt-2"
        >
          <option :value="null">Unknown</option>
          <option v-for="(_, salt) in saltDensities" :key="salt" :value="salt">{{ saltLabels[salt] }}</option>
        </select></label>
      <label class="block">Image URL (optional)<input
          v-model="form.imageUrl"
          v-bind="fieldIssue('imageUrl')"
          type="url"
          placeholder="https://"
          maxlength="2000"
          class="field mt-2"
      /></label>
    </fieldset>

    <fieldset :disabled="saving" class="space-y-5">
      <legend class="form-legend">Ingredients</legend>
      <div v-for="(row, index) in form.ingredients" :key="index" class="row-panel">
        <div class="form-grid">
          <label>Ingredient {{ index + 1 }}<input
              v-model="row.name"
              v-bind="fieldIssue('ingredients.' + index + '.name')"
              required
              maxlength="200"
              class="field mt-2"
          /></label>
          <label>Amount<input
              v-model.number="row.amount"
              v-bind="fieldIssue('ingredients.' + index + '.amount')"
              type="number"
              min="0"
              max="1000000"
              step="any"
              required
              class="field mt-2"
          /></label>
          <label>Unit<input
              v-model="row.unit"
              v-bind="fieldIssue('ingredients.' + index + '.unit')"
              list="recipe-units"
              required
              maxlength="40"
              class="field mt-2"
          /></label>
          <label>Gram equivalent (optional)<input
              :value="row.gramsEquivalent"
              v-bind="fieldIssue('ingredients.' + index + '.gramsEquivalent')"
              type="number" min="0" max="1000000" step="any" class="field mt-2"
              @input="row.gramsEquivalent = ($event.target as HTMLInputElement).value === '' ? null : Number(($event.target as HTMLInputElement).value)"
          /></label>
          <label>Ingredient notes (including original measures)<textarea
              v-model="row.notes"
              v-bind="fieldIssue('ingredients.' + index + '.notes')"
              maxlength="10000"
              class="field mt-2"
              placeholder="Diced, room temperature…"
              rows="3"
          /></label>
        </div>
        <button
          type="button"
          class="text-action mt-4"
          :aria-label="'Remove ingredient ' + (index + 1)"
          @click="form.ingredients.splice(index, 1)"
        >Remove ingredient</button>
      </div>
      <datalist id="recipe-units">
        <option
          v-for="unit in ['g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'stick', 'oz', 'lb', 'fl oz', 'piece']"
          :key="unit"
          :value="unit"
        />
      </datalist>
      <button
        type="button"
        class="button-secondary"
        @click="
          form.ingredients.push({
            name: '',
            amount: 1,
            unit: 'g',
            gramsEquivalent: null,
            category: 'pantry',
            notes: '',
            sortOrder: form.ingredients.length
          })
        "
      >+ Add ingredient</button>
    </fieldset>

    <fieldset :disabled="saving" class="space-y-5">
      <legend class="form-legend">The method</legend>
      <div v-if="canSplit" class="row-panel space-y-3" role="group" aria-labelledby="split-notes-title">
        <p id="split-notes-title" class="font-semibold">Your notes contain {{ stepCountPhrase(notesPlan!.steps.length) }} method.</p>
        <p class="text-sm">Split it into editable steps with timers where the text gives a time{{ replacesIngredients ? `, and use the ${notesPlan!.ingredients.length} ingredients listed in the notes` : '' }}. The notes keep just the story.</p>
        <button type="button" class="button-primary" @click="splitNotes">Split notes into steps</button>
      </div>
      <p v-if="splitBackup" role="status" class="flex flex-wrap items-center gap-x-3">{{ splitSummary }}<button type="button" class="text-action" @click="undoSplit">Undo split</button></p>
      <div v-for="(row, index) in form.steps" :key="index" class="row-panel space-y-5">
        <label class="block">Step {{ index + 1 }}<textarea
            v-model="row.instruction"
            v-bind="fieldIssue('steps.' + index + '.instruction')"
            required
            maxlength="10000"
            rows="3"
            class="field mt-2"
          />
        </label>
        <div class="form-grid">
          <label>Heat level<select
              v-model="row.heatLevel"
              v-bind="fieldIssue('steps.' + index + '.heatLevel')"
              aria-label="Heat level"
              class="field mt-2"
            >
              <option
                v-for="heat in ['none', 'low', 'medium-low', 'medium', 'medium-high', 'high']"
                :key="heat"
                :value="heat"
              >{{ heat }}</option>
            </select></label>
          <label>Duration (minutes)<input
              :value="row.durationMinutes"
              v-bind="fieldIssue('steps.' + index + '.durationMinutes')"
              type="number"
              min="0"
              max="100000"
              class="field mt-2"
              @input="
                row.durationMinutes =
                  ($event.target as HTMLInputElement).value === ''
                    ? null
                    : Number(($event.target as HTMLInputElement).value)
              "
          /></label>
          <label>Look for<input
              v-model="row.sensoryVisual"
              v-bind="fieldIssue('steps.' + index + '.sensoryVisual')"
              class="field mt-2"
              placeholder="A deep golden crust"
          /></label>
          <label>Listen for<input
              v-model="row.sensoryAudio"
              v-bind="fieldIssue('steps.' + index + '.sensoryAudio')"
              class="field mt-2"
              placeholder="A gentle sizzle"
          /></label>
          <label>Aroma<input
              v-model="row.sensoryAroma"
              v-bind="fieldIssue('steps.' + index + '.sensoryAroma')"
              class="field mt-2"
          /></label>
          <label>Texture<input
              v-model="row.sensoryTexture"
              v-bind="fieldIssue('steps.' + index + '.sensoryTexture')"
              class="field mt-2"
          /></label>
          <label>The science behind it<input
              v-model="row.scienceWhy"
              v-bind="fieldIssue('steps.' + index + '.scienceWhy')"
              class="field mt-2"
          /></label>
          <label>What to watch out for<input
              v-model="row.failurePrevention"
              v-bind="fieldIssue('steps.' + index + '.failurePrevention')"
              class="field mt-2"
          /></label>
        </div>
        <label class="flex items-center gap-3">
          <input
            v-model="row.timerRequired"
            v-bind="fieldIssue('steps.' + index + '.timerRequired')"
            type="checkbox"
          />
          Timer needed</label>
        <button
          type="button"
          class="text-action"
          :aria-label="'Remove step ' + (index + 1)"
          @click="form.steps.splice(index, 1)"
        >Remove step</button>
      </div>
      <button type="button" class="button-secondary" @click="addStep">+ Add step</button>
    </fieldset>

    <fieldset :disabled="saving" class="space-y-5">
      <legend class="form-legend">Equipment</legend>
      <div v-for="(row, index) in form.equipment" :key="index" class="row-panel">
        <div class="form-grid">
          <label>Equipment {{ index + 1 }}<input
              v-model="row.name"
              v-bind="fieldIssue('equipment.' + index + '.name')"
              required
              maxlength="200"
              class="field mt-2"
          /></label>
          <label>Substitute tool<input
              v-model="row.substituteTool"
              v-bind="fieldIssue('equipment.' + index + '.substituteTool')"
              class="field mt-2"
          /></label>
        </div>
        <label class="my-4 flex items-center gap-3">
          <input
            v-model="row.isEssential"
            v-bind="fieldIssue('equipment.' + index + '.isEssential')"
            type="checkbox"
          />
          Essential</label>
        <button
          type="button"
          class="text-action"
          :aria-label="'Remove equipment ' + (index + 1)"
          @click="form.equipment.splice(index, 1)"
        >Remove equipment</button>
      </div>
      <button
        type="button"
        class="button-secondary"
        @click="form.equipment.push({ name: '', isEssential: true, substituteTool: '' })"
      >+ Add equipment</button>
    </fieldset>

    <label class="block font-serif text-2xl">Heirloom notes<textarea
        v-model="form.heirloomNotes"
        v-bind="fieldIssue('heirloomNotes')"
        :rows="Math.min(14, Math.max(4, form.heirloomNotes.split('\n').length))"
        maxlength="10000"
        class="field mt-3 font-sans text-base"
        placeholder="The family story, the small secret, the person who taught you…"
      />
    </label>

    <div v-if="error" role="alert" class="notice">
      <p>{{ error }}</p>
      <ul v-if="issues.length" class="mt-3 list-inside list-disc">
        <li v-for="issue in issues" :key="issue.path" :id="'issue-' + issue.path.replaceAll('.', '-')">{{ issue.path }}:
          {{ issue.message }}</li>
      </ul>
    </div>

    <div class="flex flex-wrap gap-4">
      <button
        type="submit"
        class="button-primary"
        :disabled="saving"
        v-stable-action="state"
        :data-state="state"
        :aria-busy="saving"
      >{{ label('Save recipe', 'Saving…') }}</button>
      <button v-if="recipe" type="button" class="button-secondary" :disabled="saving" @click="emit('cancel')">Cancel
        edit</button>
      <NuxtLink v-else to="/recipes" class="button-secondary">Cancel</NuxtLink>
    </div>
  </form>
</template>
