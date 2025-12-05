<script setup>
import { ref, onMounted, watch, defineEmits, computed } from 'vue';

// Define events to communicate cart state and lesson data back to the parent
const emit = defineEmits(['update:cart', 'update:lessons']);

// --- API and State Variables ---
const apiUrl = 'https://classwork-api-demo.onrender.com/api/lessons';
const ordersApiUrl = 'https://classwork-api-demo.onrender.com/api/orders';
const lessons = ref([]); // Master list fetched from API
const cart = ref({}); // Cart structure: { lessonId: quantity }
const sortField = ref('topic');
const sortOrder = ref('asc');
const isLoading = ref(true);
const isPlacingOrder = ref(false);

// State for search and notification
const searchTerm = ref('');
// NEW STATE: Minimum available spaces filter, default to 6 (highest possible to show all)
const minSpaces = ref(1);
const notification = ref({ show: false, message: '' });
let notificationTimer = null;

// --- Checkout State ---
const isCheckoutVisible = ref(false);
const customerInfo = ref({
    name: '',
    phone: ''
});

// --- Utility Function to reliably extract the Lesson ID ---
const getLessonId = (lesson) => {
    // Check for the new format (plain string)
    if (typeof lesson._id === 'string' && lesson._id.length >= 10) {
        return lesson._id;
    }
    // Check for the old MongoDB extended JSON format (object with $oid)
    if (lesson._id && lesson._id.$oid) {
        return lesson._id.$oid;
    }
    // Fallback or handle cases where data might be malformed temporarily
    return null;
};

// --- Functions ---

// 1. Fetch Lessons (UPDATED for Search API Integration and minSpaces filter)
const fetchLessons = async () => {
    isLoading.value = true;
    let url;
    let queryString = '';

    // Prepare query parameters
    const term = searchTerm.value.trim();
    const spaces = minSpaces.value;
    url = `${apiUrl}/search`;
    
    if (term) {
        queryString = `searchTerm=${encodeURIComponent(term)}&minSpaces=${spaces}`;
    } else {
        queryString = `minSpaces=${spaces}`;
    }

    // Construct the final URL
    const finalUrl = `${url}?${queryString}`;

    try {
        const response = await fetch(finalUrl);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        lessons.value = data;
        emit('update:lessons', data);
    } catch (error) {
        console.error("Error fetching lessons:", error);
        // If the search fails, clear the list to avoid displaying old results
        lessons.value = [];
    } finally {
        isLoading.value = false;
    }
};

// 2. Display Notification (Remains unchanged)
const showNotification = (message, success = true) => {
    // Clear any existing timer to restart the animation
    if (notificationTimer) {
        clearTimeout(notificationTimer);
    }

    notification.value.message = message;
    notification.value.show = true;
    notification.value.success = success; // Store success status

    // Hide the notification after 3 seconds
    notificationTimer = setTimeout(() => {
        notification.value.show = false;
    }, 3000);
};

// 3. Add to Cart Logic (Remains unchanged)
const addToCart = (lesson) => {
    const lessonId = getLessonId(lesson);

    if (!lessonId || lessonId === '0') {
        console.error("Attempted to add a lesson without a valid ID:", lesson);
        showNotification(`Failed to add ${lesson.topic}: Invalid ID.`, false);
        return;
    }

    if (lesson.space <= 0) {
        console.warn(`Cannot add ${lesson.topic}, sold out.`);
        return;
    }

    lesson.space--;

    cart.value[lessonId] = (cart.value[lessonId] || 0) + 1;

    showNotification(`${lesson.topic} added to cart!`);

    emit('update:cart', cart.value);
};

// 4. Place Order Logic (Remains unchanged)
const placeOrder = async () => {
    if (Object.keys(cart.value).length === 0) {
        showNotification('Your cart is empty. Please add lessons first.', false);
        return;
    }

    // Basic form validation
    if (!customerInfo.value.name || !customerInfo.value.phone) {
        showNotification('Please fill in both your Name and Phone number.', false);
        return;
    }

    isPlacingOrder.value = true;

    // --- Constructing the Payload Array Correctly ---
    const lessonsMap = {};
    lessons.value.forEach(lesson => {
        const id = getLessonId(lesson);
        if (id) {
            lessonsMap[id] = lesson;
        }
    });

    const lessonsArray = [];
    let calculatedTotal = 0;

    for (const lessonId in cart.value) {
        const quantity = cart.value[lessonId];
        const lesson = lessonsMap[lessonId];

        if (!lesson || !lessonId || lessonId === '0') {
            console.warn(`Skipping invalid cart item with ID: ${lessonId}`);
            continue;
        }

        lessonsArray.push({
            id: lessonId,
            topic: lesson.topic,
            quantity: quantity,
            price: lesson.price
        });

        calculatedTotal += lesson.price * quantity;
    }

    if (lessonsArray.length === 0) {
        showNotification('No valid items found in the cart.', false);
        isPlacingOrder.value = false;
        return;
    }

    const orderData = {
        name: customerInfo.value.name,
        phone: customerInfo.value.phone,
        lessons: lessonsArray,
        total: calculatedTotal
    };

    try {
        const response = await fetch(ordersApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(orderData)
        });

        if (!response.ok) {
            const errorBody = await response.json();
            throw new Error(errorBody.message || `HTTP error! status: ${response.status}`);
        }

        // Success handling
        showNotification('Order placed successfully! Thank you!', true);

        // Reset state
        cart.value = {};
        customerInfo.value = { name: '', phone: '' };
        isCheckoutVisible.value = false;

        // Refetch lessons to update space counts across all items
        await fetchLessons();

    } catch (error) {
        console.error("Error placing order:", error.message);
        showNotification(`Failed to place order: ${error.message}`, false);
    } finally {
        isPlacingOrder.value = false;
    }
};


// 5. Trigger Fetch on Component Mount
onMounted(fetchLessons);

// 6. Watch sorting controls and re-fetch when they change 
// UPDATED: Now watches minSpaces as well
watch([sortField, sortOrder, minSpaces], fetchLessons);

// 7. WATCH search term changes and re-fetch lessons immediately
watch(searchTerm, (newTerm, oldTerm) => {
    // Only fetch if the search term has actually changed
    if (newTerm.trim() !== oldTerm.trim()) {
        fetchLessons();
    }
});


// --- Computed Properties for Filtering and Searching ---
// Since the API now handles the filtering/searching, 
// we only return the fetched lessons list, simplifying this computed property.
const filteredLessons = computed(() => {
    return lessons.value;
});

// The searchSuggestions logic below is only for the local autocomplete feature. 
// It filters the CURRENT list, but the list itself is now filtered by the API.
const searchSuggestions = computed(() => {
    const term = searchTerm.value.toLowerCase().trim();
    if (!term || filteredLessons.value.length === 0) return [];

    const uniqueTopics = new Set();
    // Only search through the currently visible/fetched lessons
    filteredLessons.value.forEach(lesson => {
        if (lesson.topic.toLowerCase().startsWith(term)) {
            uniqueTopics.add(lesson.topic);
        }
    });

    return Array.from(uniqueTopics).slice(0, 5);
});

// Calculate total items in cart for the checkout button visibility (Remains unchanged)
const totalCartItems = computed(() => {
    return Object.values(cart.value).reduce((sum, quantity) => sum + quantity, 0);
});
</script>

<template>
    <!-- 
        WORKAROUND for Vite/Vue SFC constraint: 
        We include the Font Awesome CSS link directly here, as external scripts conflict with <script setup>. 
        This loads the necessary styles for the icons defined in lesson['css-class'].
    -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"
        xintegrity="sha512-SnH5WK+bZxgPHs44uWIX+LLMDJ8g35jEw0uS8rS+k78bC2Tq9h1pZ+zB5J0d7g8q" crossorigin="anonymous"
        referrerpolicy="no-referrer" />

    <div class="relative p-6">
        <h2 class="text-3xl font-extrabold text-gray-800 mb-6 border-b pb-2">📚 Available Lessons</h2>

        <Transition name="fade-slide">
            <div v-if="notification.show"
                class="fixed top-20 right-5 z-50 p-4 font-bold rounded-xl shadow-2xl transition duration-300 transform"
                :class="notification.success ? 'bg-green-500 text-white' : 'bg-red-500 text-white'">
                {{ notification.message }}
            </div>
        </Transition>

        <div class="mb-8 flex flex-col md:flex-row gap-4">

            <div class="relative w-full md:w-1/2">
                <input type="text" placeholder="Search by topic or location..." v-model="searchTerm"
                    class="w-full p-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-blue-500 shadow-inner transition duration-150" />

            </div>

            <div class="flex flex-wrap items-center space-x-4 p-2 bg-white rounded-xl shadow-md w-full md:w-auto">
                <label for="sortField" class="font-medium text-gray-700 hidden sm:inline">Sort By:</label>
                <select id="sortField" v-model="sortField"
                    class="border p-2 rounded-lg focus:ring-blue-500 focus:border-blue-500">
                    <option value="topic">Subject</option>
                    <option value="location">Location</option>
                    <option value="price">Price</option>
                    <option value="space">Availability</option>
                </select>

                <label for="sortOrder" class="font-medium text-gray-700 hidden sm:inline">Order:</label>
                <select id="sortOrder" v-model="sortOrder"
                    class="border p-2 rounded-lg focus:ring-blue-500 focus:border-blue-500">
                    <option value="asc">Ascending</option>
                    <option value="desc">Descending</option>
                </select>

                <!-- NEW: Min Available Space Filter -->
                <label for="minSpaces" class="font-medium text-gray-700 hidden sm:inline">Min Space:</label>
                <select id="minSpaces" v-model.number="minSpaces"
                    class="border p-2 rounded-lg focus:ring-blue-500 focus:border-blue-500">
                    <!-- Options for 1 to 6 spaces (6 being the 'show all' default) -->
                    <option v-for="n in 5" :key="n" :value="n">{{ n }}</option>
                </select>
                <!-- END NEW -->
            </div>
        </div>

        <div v-if="isLoading" class="flex justify-center items-center h-40">
            <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
            <p class="ml-4 text-blue-500 font-semibold">Loading lessons...</p>
        </div>

        <div v-else-if="filteredLessons.length > 0"
            class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <div v-for="lesson in filteredLessons" :key="getLessonId(lesson)" class="p-6 bg-white border border-gray-200 rounded-2xl shadow-xl transition duration-300 
                        hover:shadow-2xl hover:bg-blue-50 transform hover:-translate-y-1"
                :class="{ 'opacity-70 ring-2 ring-red-400': lesson.space === 0 }">

                <!-- Lesson Topic with Font Awesome Icon (UPDATED) -->
                <h3 class="text-2xl font-bold text-blue-800 mb-2 flex items-center space-x-4">
                    <!-- Increased size to text-4xl and added some margin (space-x-4) -->
                    <i class="fa-solid text-4xl" :class="lesson['css-class']"></i>
                    <span>{{ lesson.topic }}</span>
                </h3>

                <p class="text-gray-600 mb-1">📍 Location: <span class="font-medium">{{ lesson.location }}</span></p>
                <p class="text-gray-600 mb-1">💰 Price: <span class="font-bold text-green-600">£{{ lesson.price
                }}</span></p>
                <p :class="{ 'text-red-600 font-bold': lesson.space <= 2, 'text-gray-500': lesson.space > 2 }">
                    Available: {{ lesson.space }} slots
                </p>

                <button @click="addToCart(lesson)" :disabled="lesson.space === 0"
                    class="mt-4 w-full py-3 rounded-xl text-white font-semibold shadow-md transition duration-150 transform hover:scale-[1.01]"
                    :class="lesson.space > 0 ? 'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400' : 'bg-gray-400 cursor-not-allowed'">
                    {{ lesson.space > 0 ? 'Add to Cart' : 'Sold Out' }}
                </button>
            </div>
        </div>
        <div v-else class="text-center py-10 text-xl text-gray-500">
            No lessons found matching your search term "{{ searchTerm }}".
        </div>

        <div v-if="totalCartItems > 0 && !isCheckoutVisible" class="fixed bottom-6 right-6 z-30">
            <button @click="isCheckoutVisible = true"
                class="flex items-center space-x-2 px-6 py-3 bg-indigo-600 text-white font-bold text-lg rounded-full shadow-2xl hover:bg-indigo-700 transition duration-300 transform hover:scale-105">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24"
                    stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round"
                        d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span>Checkout ({{ totalCartItems }})</span>
            </button>
        </div>


        <Transition name="fade">
            <div v-if="isCheckoutVisible"
                class="fixed inset-0 bg-gray-900 bg-opacity-70 z-40 flex items-center justify-center p-4">

                <div
                    class="bg-white p-8 rounded-xl shadow-2xl w-full max-w-lg transition-all duration-300 transform scale-100">
                    <h3 class="text-3xl font-bold text-gray-800 mb-6 border-b pb-2">Complete Your Order</h3>

                    <p class="text-lg font-medium mb-4 text-blue-600">Items in Cart: {{ totalCartItems }}</p>

                    <form @submit.prevent="placeOrder">
                        <div class="mb-4">
                            <label for="name" class="block text-gray-700 font-medium mb-2">Full Name</label>
                            <input type="text" id="name" v-model="customerInfo.name" required
                                class="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-indigo-500">
                        </div>
                        <div class="mb-6">
                            <label for="phone" class="block text-gray-700 font-medium mb-2">Phone Number</label>
                            <input type="tel" id="phone" v-model="customerInfo.phone" required
                                class="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-indigo-500">
                        </div>

                        <div class="flex justify-end space-x-4">
                            <button type="button" @click="isCheckoutVisible = false"
                                class="px-6 py-3 bg-gray-300 text-gray-800 font-semibold rounded-xl hover:bg-gray-400 transition duration-150"
                                :disabled="isPlacingOrder">
                                Cancel
                            </button>
                            <button type="submit"
                                class="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition duration-150 flex items-center justify-center"
                                :disabled="isPlacingOrder">
                                <span v-if="isPlacingOrder" class="flex items-center">
                                    <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                    Placing Order...
                                </span>
                                <span v-else>
                                    Place Order Now
                                </span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Transition>
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
    transform: translateX(100%);
    /* Start off-screen to the right */
}

/* Vue Transition Styles for the modal overlay */
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>