<script setup>
import { ref, computed } from 'vue';
import LessonList from './components/LessonList.vue';
import Checkout from './components/Checkout.vue';

// --- State Variables ---
const currentView = ref('list'); // 'list' or 'checkout'
const cart = ref({}); // Shared cart state: { lessonId: quantity }
const lessons = ref([]); // Master list of lessons fetched by LessonList

// --- Computed Properties ---

// Calculate the total number of items in the cart for the badge
const totalCartItems = computed(() => {
  return Object.values(cart.value).reduce((sum, quantity) => sum + quantity, 0);
});

// --- Handlers for LessonList Emits ---

// Updates the cart state when LessonList calls 'update:cart'
const updateCart = (newCart) => {
  cart.value = { ...newCart }; // Deep copy the emitted cart object
};

// Updates the master lesson list when LessonList calls 'update:lessons'
const updateLessons = (newLessons) => {
  lessons.value = newLessons;
};

// Resets cart state and switches view after a successful order
const handleOrderPlaced = () => {
  cart.value = {}; // Reset the cart
  currentView.value = 'list';
};

// Inside <script setup> of the parent component (App.vue)

const handleRemoveItem = (lessonId, quantityToRemove = 1) => {
  if (cart.value[lessonId] > 0) {
    // 1. Update the Cart State
    cart.value[lessonId] = Math.max(0, cart.value[lessonId] - quantityToRemove);
    if (cart.value[lessonId] === 0) {
      delete cart.value[lessonId];
    }

    // 2. Update the Lesson Space (find and increment the space)
    const lessonIndex = lessons.value.findIndex(l => (l._id.$oid || l._id) === lessonId);
    if (lessonIndex !== -1) {
      lessons.value[lessonIndex].space += quantityToRemove;
    }
  }
  // You might want to force a re-render or re-fetch lessons to fully sync the view
};

</script>

<template>
  <!-- Tailwind is assumed to be set up and working with the global style.css -->
  <div class="min-h-screen bg-gray-100 font-sans">

    <!-- Header/Navigation Bar -->
    <header class="bg-blue-700 p-4 shadow-xl sticky top-0 z-10">
      <div class="container mx-auto flex justify-between items-center">
        <!-- Logo/Title: Click to return to list view -->
        <h1
          class="text-white text-3xl font-extrabold tracking-wide cursor-pointer transition duration-150 hover:opacity-90"
          @click="currentView = 'list'">
          Classwork Store
        </h1>

        <!-- Cart Button -->
        <button @click="currentView = 'checkout'"
          class="relative bg-yellow-400 text-blue-900 font-bold py-2 px-4 rounded-full shadow-lg hover:bg-yellow-300 transition duration-150 transform hover:scale-105">
          <span class="text-xl">🛒</span>
          <span class="ml-2 hidden sm:inline">Checkout</span>
          <!-- Cart Badge -->
          <span v-if="totalCartItems > 0"
            class="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ring-2 ring-blue-700">
            {{ totalCartItems }}
          </span>
        </button>
      </div>
    </header>

    <!-- Main Content Area -->
    <main class="container mx-auto p-4 md:p-8">

      <!-- Lesson List View -->
      <LessonList v-if="currentView === 'list'" @update:cart="updateCart" @update:lessons="updateLessons" />

      <!-- Checkout View -->
      <Checkout :cart="cart" :lessons="lessons" @orderPlaced="handleOrderCompletion"
        @updateCartTotal="updateHeaderCount" @removeItemFromCart="handleRemoveItem" />
    </main>

    <!-- Footer -->
    <footer class="text-center py-4 text-gray-600 text-sm bg-white shadow-inner mt-10">
      Deployed API: <a href="https://classwork-api-demo.onrender.com" target="_blank"
        class="text-blue-500 hover:underline">https://classwork-api-demo.onrender.com</a>
    </footer>
  </div>
</template>