<script setup>
import { ref, onMounted, watch, defineEmits, defineProps } from 'vue';

// Define events to communicate cart state and lesson data back to the parent
const emit = defineEmits(['update:cart', 'update:lessons']);

// --- API and State Variables ---
const apiUrl = 'https://classwork-api-demo.onrender.com/api/lessons';
const lessons = ref([]);
const cart = ref({}); // Cart structure: { lessonId: quantity }
const sortField = ref('topic');
const sortOrder = ref('asc');
const isLoading = ref(true);

// --- Functions ---

// 1. Fetch Lessons (Uses native fetch/promise)
const fetchLessons = async () => {
    isLoading.value = true;
    // Construct the URL with query parameters for sorting
    const url = `${apiUrl}?sortField=${sortField.value}&sortOrder=${sortOrder.value}`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Update the reactive state
        lessons.value = data;

        // Emit the current list of lessons to the parent
        emit('update:lessons', data);
    } catch (error) {
        console.error("Error fetching lessons:", error);
        // Fallback or user message needed here
    } finally {
        isLoading.value = false;
    }
};

// 2. Add to Cart Logic
const addToCart = (lesson) => {
    // Check if the lesson object uses the $oid format from MongoDB/Express
    const lessonId = lesson._id.$oid || lesson._id;

    // Check if space is available
    if (lesson.space <= 0) {
        // Simple message box instead of alert()
        console.warn(`Cannot add ${lesson.topic}, sold out.`);
        return;
    }

    // Decrement the local space count immediately for visual feedback
    lesson.space--;

    // Update the cart state
    cart.value[lessonId] = (cart.value[lessonId] || 0) + 1;

    // Emit the updated cart object to the parent
    emit('update:cart', cart.value);
};

// 3. Trigger Fetch on Component Mount
onMounted(fetchLessons);

// 4. Watch sorting controls and re-fetch when they change
watch([sortField, sortOrder], fetchLessons);
</script>

<template>
    <div class="p-6">
        <h2 class="text-3xl font-extrabold text-gray-800 mb-6 border-b pb-2">📚 Available Lessons</h2>

        <!-- Sorting Options -->
        <div class="mb-8 flex flex-wrap items-center space-x-4 p-4 bg-gray-100 rounded-xl shadow-inner">
            <label for="sortField" class="font-medium text-gray-700">Sort By:</label>
            <select id="sortField" v-model="sortField"
                class="border p-2 rounded-lg focus:ring-blue-500 focus:border-blue-500">
                <option value="topic">Subject</option>
                <option value="location">Location</option>
                <option value="price">Price</option>
                <option value="space">Availability</option>
            </select>

            <label for="sortOrder" class="font-medium text-gray-700">Order:</label>
            <select id="sortOrder" v-model="sortOrder"
                class="border p-2 rounded-lg focus:ring-blue-500 focus:border-blue-500">
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
            </select>
        </div>

        <div v-if="isLoading" class="flex justify-center items-center h-40">
            <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
            <p class="ml-4 text-blue-500 font-semibold">Loading lessons...</p>
        </div>

        <!-- Lesson List Grid -->
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <div v-for="lesson in lessons" :key="lesson._id.$oid || lesson._id"
                class="p-6 bg-white border border-gray-200 rounded-xl shadow-lg transition duration-300 hover:shadow-xl transform hover:-translate-y-1"
                :class="{ 'bg-red-50 ring-2 ring-red-400': lesson.space === 0 }">

                <h3 class="text-2xl font-bold text-blue-700 mb-2">{{ lesson.topic }}</h3>
                <p class="text-gray-600 mb-1">Location: <span class="font-medium">{{ lesson.location }}</span></p>
                <p class="text-gray-600 mb-1">Price: <span class="font-bold text-green-600">£{{ lesson.price }}</span>
                </p>
                <p :class="{ 'text-red-600 font-bold': lesson.space <= 2, 'text-gray-500': lesson.space > 2 }">
                    Availability: {{ lesson.space }} slots
                </p>

                <button @click="addToCart(lesson)" :disabled="lesson.space === 0"
                    class="mt-4 w-full py-3 rounded-xl text-white font-semibold shadow-md transition duration-150 transform hover:scale-[1.01]"
                    :class="lesson.space > 0 ? 'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400' : 'bg-gray-400 cursor-not-allowed'">
                    {{ lesson.space > 0 ? 'Add to Cart' : 'Sold Out' }}
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Optional: Custom style for key colors */
</style>