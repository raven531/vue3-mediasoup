<template>
    <div class="home">
        <div class="container">
            <div id="login">
                <br />
                <i class="fas fa-server"> Room: </i><input id="roomidInput" v-model="roomId" value="123" type="text" />
                <i class="fas fa-user"> User: </i><input id="nameInput" v-model="username" value="user" type="text" />
                <button id="joinButton" @click="joinRoom">
                    <i class="fas fa-sign-in-alt"></i> Join
                </button>
            </div>
        </div>
    </div>
</template>

<script>
import { ref } from 'vue';
import { useRouter } from 'vue-router';

export default {
    name: 'Home',
    setup() {
        const router = useRouter();
        const roomId = ref('123');
        const username = ref('user');

        const joinRoom = () => {
            if (!username.value) return;

            // Update the hidden input values (for compatibility with RoomClient)
            if (document.getElementById('roomidInput')) {
                document.getElementById('roomidInput').value = roomId.value;
            }

            if (document.getElementById('nameInput')) {
                document.getElementById('nameInput').value = username.value;
            }

            const roomToJoin = roomId.value || '123';
            router.push({
                name: 'Room',
                params: {
                    id: roomToJoin
                },
                query: {
                    name: username.value
                }
            });
        };

        return {
            roomId,
            username,
            joinRoom
        };
    }
}
</script>

<style scoped>
.home {
    padding: 40px 0;
}

#login {
    margin: 20px 0;
    width: 100%;
}

/* Inputs and buttons styled by main.css */
</style>