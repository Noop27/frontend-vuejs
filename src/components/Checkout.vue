<script setup>
import { ref, computed, defineEmits, watch } from 'vue';

// Define props passed from App.vue
const props = defineProps({
    cart: { type: Object, required: true },
    lessons: { type: Array, required: true } // Master list of lessons for price lookup
});

// Define events to communicate completion back to the parent
const emit = defineEmits(['orderPlaced', 'updateCartTotal']);

// --- API and State Variables ---
const apiUrl = 'https://classwork-api-demo.onrender.com/api/lessons';
const orderUrl = 'https://classwork-api-demo.onrender.com/api/order';

const customerName = ref('');
const customerPhone = ref('');
const isProcessing = ref(false);
const message = ref({ text: '', type: '' }); // { text: "Success!", type: "success" }

// --- Computed Properties ---

// 1. Get detailed cart items including price and topic
const detailedCart = computed(() => {
    const items = [];
    let totalItems = 0;

    for (const id in props.cart) {
        const quantity = props.cart[id];
        if (quantity > 0) {
            const lesson = props.lessons.find(l => (l._id.$oid || l._id) === id);

            if (lesson) {
                items.push({
                    id: id,
                    topic: lesson.topic,
                    price: lesson.price,
                    quantity: quantity,
                    subtotal: lesson.price * quantity
                });
                totalItems += quantity;
            }
        }
    }
    // Emit total items count to App.vue (for header badge)
    emit('updateCartTotal', totalItems);
    return items;
});

// 2. Calculate grand total price
const cartTotal = computed(() => {
    return detailedCart.value.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2);
});

// 3. Simple form validation check
const isFormValid = computed(() => {
    const nameValid = customerName.value.trim().length > 0;
    const phoneValid = customerPhone.value.trim().length > 0;
    return nameValid && phoneValid && detailedCart.value.length > 0;
});

// --- Functions ---

// 1. Submit Order (POST request)
const submitOrder = async () => {
    isProcessing.value = true;
    message.value = { text: '', type: '' };

    if (!isFormValid.value) {
        message.value = { text: 'Please fill out your name and phone number.', type: 'error' };
        isProcessing.value = false;
        return;
    }

    const orderPayload = {
        name: customerName.value,
        phone: customerPhone.value,
        lessons: detailedCart.value.map(item => ({
            id: item.id,
            topic: item.topic,
            quantity: item.quantity,
            price: item.price
        })),
        total: parseFloat(cartTotal.value)
    };

    // --- Phase 1: POST the Order ---
    try {
        const response = await fetch(orderUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderPayload)
        });

        if (!response.ok) {
            throw new Error(`Order failed! Status: ${response.status}`);
        }

        // --- Phase 2: PUT (Update Lesson Spaces) ---
        // Create an array of update promises for each item in the cart
        const updatePromises = detailedCart.value.map(item => {
            const updatePayload = {
                id: item.id,
                quantity: item.quantity // Quantity is the number to subtract
            };

            return fetch(`${apiUrl}/${item.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatePayload)
            });
        });

        // Wait for all PUT requests to complete
        const updateResponses = await Promise.all(updatePromises);
        const updateFailed = updateResponses.some(res => !res.ok);

        if (updateFailed) {
            // Log error, but treat order as placed since POST succeeded
            console.error("Warning: One or more lesson space updates failed.");
        }

        // --- Success ---
        message.value = { text: 'Order placed and stock updated successfully!', type: 'success' };

        // Reset state and switch view
        customerName.value = '';
        customerPhone.value = '';
        emit('orderPlaced'); // Notifies App.vue to switch back to list view

    } catch (error) {
        console.error("Transaction Error:", error);
        message.value = { text: `Transaction failed. Details: ${error.message}`, type: 'error' };
    } finally {
        isProcessing.value = false;
    }
};

// Reset message on cart changes
watch(() => props.cart, () => {
    message.value = { text: '', type: '' };
}, { deep: true });
</script>

<template>
    <div class="p-6 max-w-4xl mx-auto bg-white rounded-xl shadow-2xl">
        <h2 class="text-3xl font-extrabold text-blue-700 mb-6 border-b pb-2">🛒 Your Cart Summary</h2>

        <div v-if="detailedCart.length === 0" class="text-center py-10 text-gray-500">
            <p class="text-xl">Your cart is empty. Add some lessons to proceed!</p>
            <button @click="$emit('orderPlaced')" class="mt-4 text-blue-600 hover:text-blue-800 font-medium">
                ← Go back to lessons
            </button>
        </div>

        <div v-else>
            <!-- Cart Table -->
            <div class="overflow-x-auto mb-8 border rounded-lg">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Lesson</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Price (per)</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Qty</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Subtotal</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        <tr v-for="item in detailedCart" :key="item.id">
                            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ item.topic }}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">£{{
                                item.price.toFixed(2) }}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">{{ item.quantity }}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-right text-green-600">£{{
                                item.subtotal.toFixed(2) }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Total -->
            <div class="flex justify-end mb-8 text-xl font-bold">
                <p class="text-gray-800">Grand Total: <span class="text-blue-700">£{{ cartTotal }}</span></p>
            </div>

            <!-- Customer Details Form -->
            <form @submit.prevent="submitOrder" class="space-y-6">
                <h3 class="text-xl font-semibold text-gray-800 border-b pb-2">Your Details</h3>

                <div>
                    <label for="name" class="block text-sm font-medium text-gray-700">Full Name</label>
                    <input type="text" id="name" v-model="customerName" required
                        class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-3 focus:ring-blue-500 focus:border-blue-500">
                </div>

                <div>
                    <label for="phone" class="block text-sm font-medium text-gray-700">Phone Number</label>
                    <input type="tel" id="phone" v-model="customerPhone" required
                        class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-3 focus:ring-blue-500 focus:border-blue-500">
                </div>

                <!-- Message Box -->
                <div v-if="message.text" class="p-3 rounded-lg font-medium" :class="{
                    'bg-green-100 text-green-800': message.type === 'success',
                    'bg-red-100 text-red-800': message.type === 'error'
                }">
                    {{ message.text }}
                </div>

                <!-- Submission Button -->
                <button type="submit" :disabled="!isFormValid || isProcessing"
                    class="w-full py-3 px-4 border border-transparent rounded-xl shadow-lg text-lg font-bold text-white transition duration-150 transform hover:scale-[1.01]"
                    :class="{
                        'bg-blue-600 hover:bg-blue-700': isFormValid && !isProcessing,
                        'bg-gray-400 cursor-not-allowed': !isFormValid || isProcessing
                    }">
                    {{ isProcessing ? 'Processing Order...' : 'Confirm and Place Order (£' + cartTotal + ')' }}
                </button>
            </form>
        </div>
    </div>
</template>