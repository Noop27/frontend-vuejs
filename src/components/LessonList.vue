<script setup>
import { ref, onMounted, watch, defineEmits, computed } from 'vue';

// Define events to communicate cart state and lesson data back to the parent
const emit = defineEmits(['update:cart', 'update:lessons']);

// --- API and State Variables ---
const apiUrl = 'https://classwork-api-demo.onrender.com/api/lessons';
const lessons = ref([]); // Master list fetched from API
const cart = ref({}); // Cart structure: { lessonId: quantity }
const sortField = ref('topic');
const sortOrder = ref('asc');
const isLoading = ref(true);

// State for search and notification
const searchTerm = ref(''); // New state for search input
const notification = ref({ show: false, message: '' });
let notificationTimer = null; // To hold the timer ID

// --- Functions ---

// 1. Fetch Lessons (Uses native fetch/promise)
const fetchLessons = async () => {
    isLoading.value = true;
    // We fetch the entire list first
    const url = `${apiUrl}?sortField=${sortField.value}&sortOrder=${sortOrder.value}`;
    
    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        lessons.value = data;
        emit('update:lessons', data);
    } catch (error) {
        console.error("Error fetching lessons:", error);
    } finally {
        isLoading.value = false;
    }
};

// 2. Display Notification
const showNotification = (message) => {
    // Clear any existing timer to restart the animation
    if (notificationTimer) {
        clearTimeout(notificationTimer);
    }

    notification.value.message = message;
    notification.value.show = true;

    // Hide the notification after 3 seconds
    notificationTimer = setTimeout(() => {
        notification.value.show = false;
    }, 3000);
};

// 3. Add to Cart Logic
const addToCart = (lesson) => {
    const lessonId = lesson._id.$oid || lesson._id; 
    
    if (lesson.space <= 0) {
        console.warn(`Cannot add ${lesson.topic}, sold out.`);
        return;
    }

    // Decrement the local space count immediately for visual feedback
    lesson.space--;

    // Update the cart state
    cart.value[lessonId] = (cart.value[lessonId] || 0) + 1;
    
    // Show the success notification with animation
    showNotification(`${lesson.topic} added to cart!`);

    // Emit the updated cart object to the parent
    emit('update:cart', cart.value);
};

// 4. Trigger Fetch on Component Mount
onMounted(fetchLessons);

// 5. Watch sorting controls and re-fetch when they change
watch([sortField, sortOrder], fetchLessons);


// --- Computed Properties for Filtering and Searching ---

// 6. Main computed property that filters the lessons array
const filteredLessons = computed(() => {
    const term = searchTerm.value.toLowerCase().trim();
    
    // If no search term, return the full lessons list
    if (!term) {
        return lessons.value;
    }
    
    // Filter the list based on topic, location, or description
    return lessons.value.filter(lesson => {
        const topic = lesson.topic.toLowerCase();
        const location = lesson.location.toLowerCase();
        const description = lesson.description ? lesson.description.toLowerCase() : '';
        
        return topic.includes(term) || location.includes(term) || description.includes(term);
    });
});

// 7. Autocomplete/Suggestion List (Simplified)
const searchSuggestions = computed(() => {
    const term = searchTerm.value.toLowerCase().trim();
    if (!term || filteredLessons.value.length === 0) return [];
    
    // Get unique topics that match the current filter
    const uniqueTopics = new Set();
    filteredLessons.value.forEach(lesson => {
        // Only suggest if the topic starts with the search term
        if (lesson.topic.toLowerCase().startsWith(term)) {
            uniqueTopics.add(lesson.topic);
        }
    });
    
    // Convert set to array and limit to top 5 suggestions
    return Array.from(uniqueTopics).slice(0, 5);
});
</script>

<template>
    <div class="relative p-6">
        <h2 class="text-3xl font-extrabold text-gray-800 mb-6 border-b pb-2">📚 Available Lessons</h2>

        <!-- Notification Message (Animated) -->
        <Transition name="fade-slide">
            <div v-if="notification.show"
                class="fixed top-20 right-5 z-50 p-4 bg-green-500 text-white font-bold rounded-xl shadow-2xl transition duration-300 transform"
            >
                {{ notification.message }}
            </div>
        </Transition>
        
        <!-- Search and Sorting Container -->
        <div class="mb-8 flex flex-col md:flex-row gap-4">
            
            <!-- Search Input with Simplified Autocomplete -->
            <div class="relative w-full md:w-1/2">
                <input 
                    type="text"
                    placeholder="Search by topic or location..."
                    v-model="searchTerm"
                    class="w-full p-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-blue-500 shadow-inner transition duration-150"
                />
                
                <!-- Autocomplete Dropdown -->
                <div v-if="searchTerm && searchSuggestions.length > 0" 
                     class="absolute z-40 w-full bg-white border border-gray-200 rounded-xl mt-1 shadow-lg max-h-40 overflow-y-auto">
                    <button 
                        v-for="suggestion in searchSuggestions"
                        :key="suggestion"
                        @click="searchTerm = suggestion; "
                        class="w-full text-left p-3 text-gray-700 hover:bg-blue-50 transition duration-100"
                    >
                        {{ suggestion }}
                    </button>
                </div>
            </div>

            <!-- Sorting Options -->
            <div class="flex flex-wrap items-center space-x-4 p-2 bg-white rounded-xl shadow-md w-full md:w-auto">
                <label for="sortField" class="font-medium text-gray-700 hidden sm:inline">Sort By:</label>
                <select id="sortField" v-model="sortField" class="border p-2 rounded-lg focus:ring-blue-500 focus:border-blue-500">
                    <option value="topic">Subject</option>
                    <option value="location">Location</option>
                    <option value="price">Price</option>
                    <option value="space">Availability</option>
                </select>

                <label for="sortOrder" class="font-medium text-gray-700 hidden sm:inline">Order:</label>
                <select id="sortOrder" v-model="sortOrder" class="border p-2 rounded-lg focus:ring-blue-500 focus:border-blue-500">
                    <option value="asc">Ascending</option>
                    <option value="desc">Descending</option>
                </select>
            </div>
        </div>

        <div v-if="isLoading" class="flex justify-center items-center h-40">
            <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
            <p class="ml-4 text-blue-500 font-semibold">Loading lessons...</p>
        </div>
        
        <!-- Lesson List Grid: Responsive Layout (1, 2, 3, 4 columns) -->
        <!-- *** Now iterates over filteredLessons *** -->
        <div v-else-if="filteredLessons.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <div v-for="lesson in filteredLessons" :key="lesson._id.$oid || lesson._id" 
                 class="p-6 bg-white border border-gray-200 rounded-2xl shadow-xl transition duration-300 
                        hover:shadow-2xl hover:bg-blue-50 transform hover:-translate-y-1"
                 :class="{'opacity-70 ring-2 ring-red-400': lesson.space === 0}">

                <h3 class="text-2xl font-bold text-blue-800 mb-2">{{ lesson.topic }}</h3>
                <p class="text-gray-600 mb-1">📍 Location: <span class="font-medium">{{ lesson.location }}</span></p>
                <p class="text-gray-600 mb-1">💰 Price: <span class="font-bold text-green-600">£{{ lesson.price }}</span></p>
                <p :class="{'text-red-600 font-bold': lesson.space <= 2, 'text-gray-500': lesson.space > 2}">
                    Available: {{ lesson.space }} slots
                </p>
                
                <button 
                    @click="addToCart(lesson)" 
                    :disabled="lesson.space === 0"
                    class="mt-4 w-full py-3 rounded-xl text-white font-semibold shadow-md transition duration-150 transform hover:scale-[1.01]"
                    :class="lesson.space > 0 ? 'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400' : 'bg-gray-400 cursor-not-allowed'"
                >
                    {{ lesson.space > 0 ? 'Add to Cart' : 'Sold Out' }}
                </button>
            </div>
        </div>
        <div v-else class="text-center py-10 text-xl text-gray-500">
            No lessons found matching your search term "{{ searchTerm }}".
        </div>
    </div>
</template>

<style scoped>
/* Vue Transition Styles for the notification */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity 0.5s ease, transform 0.5s ease;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateX(100%); /* Start off-screen to the right */
}
</style>