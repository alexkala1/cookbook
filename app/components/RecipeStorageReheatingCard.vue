<script setup lang="ts">
import { inferStorageReheating, isStorageReheatingApplicable, storageReheatingLabels, type StorageReheatingRecipe } from '#shared/culinary/storage-reheating'

const props = withDefaults(defineProps<{ recipe: StorageReheatingRecipe, heading?: string, kitchen?: boolean }>(), {
  heading: 'Storage & Texture-Preserving Reheating', kitchen: false
})
const headingId = useId()
const advice = computed(() => inferStorageReheating(props.recipe))
const applianceLabels = { oven: 'Oven', air_fryer: 'Air fryer', stovetop: 'Stovetop', skillet: 'Skillet', microwave: 'Microwave' }
</script>

<template>
  <section v-if="isStorageReheatingApplicable(recipe)" :aria-labelledby="headingId" data-testid="storage-reheating-card" class="min-w-0 rounded-xl border p-5" :class="kitchen ? 'border-k-accent bg-k-paper text-k-ink' : 'border-rule bg-paper-2 text-ink'">
    <component :is="kitchen ? 'h3' : 'h2'" :id="headingId" class="font-serif text-2xl">{{ heading }}</component>
    <p class="mt-2 text-sm" :class="kitchen ? 'text-k-ink' : 'text-muted'">{{ storageReheatingLabels[advice.category] }} · guidance for promptly chilled, cooked leftovers</p>
    <div class="mt-3 flex flex-wrap gap-2 text-sm font-semibold">
      <span class="rounded-full border px-3 py-1">Fridge: up to {{ advice.fridgeLifeDays }} {{ advice.fridgeLifeDays === 1 ? 'day' : 'days' }} at ≤4°C</span>
      <span class="rounded-full border px-3 py-1">{{ advice.freezerFriendly ? `Freezer-friendly · ${advice.freezerLifeMonths} ${advice.freezerLifeMonths === 1 ? 'month' : 'months'} for best texture` : 'Freezing not recommended for texture' }}</span>
    </div>
    <p class="mt-3 text-sm leading-relaxed">Refrigerate promptly in shallow portions — within {{ advice.fridgeLifeDays === 1 ? '1 hour for rice' : '2 hours (1 hour above 32°C)' }}. Storage limits assume correct cooling and refrigeration.</p>
    <p class="mt-4 font-semibold">{{ advice.category === 'crispy' ? 'Oven / air fryer' : applianceLabels[advice.reheating.appliance] }}<span v-if="advice.reheating.targetTempC"> · {{ advice.reheating.targetTempC }}°C appliance setting</span></p>
    <p class="mt-2 leading-relaxed">{{ advice.reheating.instructions }}</p>
    <p v-if="advice.reheating.doNotMicrowave" class="mt-2 font-semibold" :class="kitchen ? 'text-k-accent' : 'text-terracotta-ink'">Do not microwave — preserve the crisp crust.</p>
    <p v-if="advice.reheating.chemistryNote" class="mt-3 text-sm leading-relaxed"><strong>Why:</strong> {{ advice.reheating.chemistryNote }}</p>
    <details class="mt-4">
      <summary class="inline-flex min-h-11 cursor-pointer items-center font-semibold underline">Safe storage tips</summary>
      <ul class="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed">
        <li v-for="tip in advice.storageTips" :key="tip">{{ tip }}</li>
      </ul>
      <p class="mt-3 text-sm">Safety basis: <a href="https://www.foodsafety.gov/food-safety-charts/cold-food-storage-charts" class="inline-flex min-h-11 items-center underline">USDA / FoodSafety.gov</a> · <a href="https://www.gov.uk/government/publications/home-food-fact-checker/home-food-fact-checker#rice" class="inline-flex min-h-11 items-center underline">FSA rice guidance</a>. Texture methods and times are estimates; check the food’s centre reaches 74°C.</p>
    </details>
  </section>
</template>
