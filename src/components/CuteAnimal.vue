<!-- src/components/CuteAnimal.vue -->
<template>
  <div class="animal-wrap" :class="animal">
    <!-- Cat -->
    <div v-if="animal === 'cat'" class="cat">
      <div class="ear ear-l"></div>
      <div class="ear ear-r"></div>
      <div class="face">
        <div class="eye eye-l"></div>
        <div class="eye eye-r"></div>
        <div class="nose"></div>
        <div class="mouth"></div>
      </div>
      <div class="tail"></div>
    </div>

    <!-- Dog -->
    <div v-else-if="animal === 'dog'" class="dog">
      <div class="ear ear-l"></div>
      <div class="ear ear-r"></div>
      <div class="face">
        <div class="eye eye-l"></div>
        <div class="eye eye-r"></div>
        <div class="snout">
          <div class="nose"></div>
          <div class="tongue"></div>
        </div>
      </div>
    </div>

    <!-- Penguin -->
    <div v-else-if="animal === 'penguin'" class="penguin">
      <div class="body">
        <div class="belly"></div>
        <div class="eye eye-l"></div>
        <div class="eye eye-r"></div>
        <div class="beak"></div>
        <div class="foot foot-l"></div>
        <div class="foot foot-r"></div>
      </div>
    </div>

    <!-- Rabbit -->
    <div v-else-if="animal === 'rabbit'" class="rabbit">
      <div class="ear ear-l"></div>
      <div class="ear ear-r"></div>
      <div class="face">
        <div class="eye eye-l"></div>
        <div class="eye eye-r"></div>
        <div class="nose"></div>
        <div class="cheek cheek-l"></div>
        <div class="cheek cheek-r"></div>
      </div>
    </div>

    <!-- Bear -->
    <div v-else-if="animal === 'bear'" class="bear">
      <div class="ear ear-l"></div>
      <div class="ear ear-r"></div>
      <div class="face">
        <div class="eye eye-l"></div>
        <div class="eye eye-r"></div>
        <div class="snout">
          <div class="nose"></div>
        </div>
      </div>
    </div>

    <!-- Frog -->
    <div v-else-if="animal === 'frog'" class="frog">
      <div class="eye-bump eye-bump-l">
        <div class="eye"></div>
      </div>
      <div class="eye-bump eye-bump-r">
        <div class="eye"></div>
      </div>
      <div class="face">
        <div class="mouth"></div>
        <div class="cheek cheek-l"></div>
        <div class="cheek cheek-r"></div>
      </div>
    </div>

    <!-- Chick -->
    <div v-else-if="animal === 'chick'" class="chick">
      <div class="body">
        <div class="eye eye-l"></div>
        <div class="eye eye-r"></div>
        <div class="beak"></div>
        <div class="cheek cheek-l"></div>
        <div class="cheek cheek-r"></div>
        <div class="wing"></div>
      </div>
    </div>

    <!-- Panda -->
    <div v-else-if="animal === 'panda'" class="panda">
      <div class="ear ear-l"></div>
      <div class="ear ear-r"></div>
      <div class="face">
        <div class="eye-patch eye-patch-l">
          <div class="eye"></div>
        </div>
        <div class="eye-patch eye-patch-r">
          <div class="eye"></div>
        </div>
        <div class="nose"></div>
        <div class="mouth"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  animal: { type: String, required: true },
})
</script>

<style scoped>
.animal-wrap {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

/* ======================== CAT ======================== */
.cat {
  position: relative;
  width: 36px;
  height: 32px;
}
.cat .ear {
  position: absolute;
  top: -8px;
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-bottom: 10px solid #FFB347;
}
.cat .ear-l { left: 3px; transform: rotate(-10deg); }
.cat .ear-r { right: 3px; transform: rotate(10deg); }
.cat .face {
  width: 36px;
  height: 28px;
  background: #FFB347;
  border-radius: 50% 50% 45% 45%;
  position: relative;
}
.cat .eye {
  position: absolute;
  width: 5px;
  height: 6px;
  background: #333;
  border-radius: 50%;
  top: 10px;
  animation: catBlink 3s infinite;
}
.cat .eye-l { left: 8px; }
.cat .eye-r { right: 8px; }
.cat .nose {
  position: absolute;
  width: 4px;
  height: 3px;
  background: #FF8A80;
  border-radius: 50%;
  top: 17px;
  left: 50%;
  transform: translateX(-50%);
}
.cat .mouth {
  position: absolute;
  width: 10px;
  height: 4px;
  border-bottom: 1.5px solid #C68642;
  border-radius: 0 0 50% 50%;
  top: 19px;
  left: 50%;
  transform: translateX(-50%);
}
.cat .tail {
  position: absolute;
  width: 14px;
  height: 14px;
  border: 3px solid #FFB347;
  border-color: transparent #FFB347 #FFB347 transparent;
  border-radius: 0 0 50% 0;
  bottom: 0;
  right: -10px;
  transform-origin: left top;
  animation: tailWag 1.2s ease-in-out infinite;
}
@keyframes catBlink {
  0%, 92%, 100% { transform: scaleY(1); }
  95% { transform: scaleY(0.1); }
}
@keyframes tailWag {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(20deg); }
}

/* ======================== DOG ======================== */
.dog {
  position: relative;
  width: 36px;
  height: 34px;
}
.dog .ear {
  position: absolute;
  width: 10px;
  height: 16px;
  background: #A0522D;
  border-radius: 50% 50% 40% 40%;
  top: -2px;
}
.dog .ear-l {
  left: 0;
  transform: rotate(-15deg);
  animation: dogEarL 1.5s ease-in-out infinite;
}
.dog .ear-r {
  right: 0;
  transform: rotate(15deg);
  animation: dogEarR 1.5s ease-in-out infinite;
}
.dog .face {
  width: 34px;
  height: 30px;
  background: #D2A679;
  border-radius: 50% 50% 45% 45%;
  position: relative;
  margin-top: 4px;
}
.dog .eye {
  position: absolute;
  width: 5px;
  height: 5px;
  background: #333;
  border-radius: 50%;
  top: 9px;
  animation: catBlink 4s infinite;
}
.dog .eye-l { left: 7px; }
.dog .eye-r { right: 7px; }
.dog .snout {
  position: absolute;
  width: 16px;
  height: 10px;
  background: #F5DEB3;
  border-radius: 50%;
  bottom: 3px;
  left: 50%;
  transform: translateX(-50%);
}
.dog .nose {
  width: 5px;
  height: 4px;
  background: #333;
  border-radius: 50%;
  margin: 1px auto 0;
}
.dog .tongue {
  width: 5px;
  height: 0;
  background: #FF8A80;
  border-radius: 0 0 3px 3px;
  margin: 0 auto;
  animation: tongueOut 2s ease-in-out infinite;
}
@keyframes dogEarL {
  0%, 100% { transform: rotate(-15deg); }
  50% { transform: rotate(-25deg); }
}
@keyframes dogEarR {
  0%, 100% { transform: rotate(15deg); }
  50% { transform: rotate(25deg); }
}
@keyframes tongueOut {
  0%, 60%, 100% { height: 0; }
  30% { height: 5px; }
}

/* ======================== PENGUIN ======================== */
.penguin {
  position: relative;
  width: 32px;
  height: 40px;
  animation: penguinWaddle 1s ease-in-out infinite;
}
.penguin .body {
  width: 32px;
  height: 36px;
  background: #2C3E50;
  border-radius: 50% 50% 45% 45%;
  position: relative;
}
.penguin .belly {
  position: absolute;
  width: 22px;
  height: 22px;
  background: #ECF0F1;
  border-radius: 50%;
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%);
}
.penguin .eye {
  position: absolute;
  width: 5px;
  height: 5px;
  background: #fff;
  border-radius: 50%;
  top: 10px;
  box-shadow: inset -1.5px 0 0 #333;
  animation: catBlink 3.5s infinite;
}
.penguin .eye-l { left: 6px; }
.penguin .eye-r { right: 6px; }
.penguin .beak {
  position: absolute;
  width: 8px;
  height: 4px;
  background: #F39C12;
  border-radius: 0 0 50% 50%;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
}
.penguin .foot {
  position: absolute;
  width: 8px;
  height: 4px;
  background: #F39C12;
  border-radius: 50%;
  bottom: -3px;
}
.penguin .foot-l { left: 3px; }
.penguin .foot-r { right: 3px; }
@keyframes penguinWaddle {
  0%, 100% { transform: rotate(-3deg); }
  50% { transform: rotate(3deg); }
}

/* ======================== RABBIT ======================== */
.rabbit {
  position: relative;
  width: 32px;
  height: 38px;
}
.rabbit .ear {
  position: absolute;
  width: 8px;
  height: 20px;
  background: #F5F5F5;
  border-radius: 50%;
  top: -12px;
  box-shadow: inset 0 0 0 2px #FFB6C1;
}
.rabbit .ear-l {
  left: 6px;
  transform: rotate(-10deg);
  animation: rabbitEarL 2s ease-in-out infinite;
}
.rabbit .ear-r {
  right: 6px;
  transform: rotate(10deg);
  animation: rabbitEarR 2s ease-in-out infinite;
}
.rabbit .face {
  width: 32px;
  height: 28px;
  background: #F5F5F5;
  border-radius: 50%;
  position: relative;
  margin-top: 8px;
}
.rabbit .eye {
  position: absolute;
  width: 4px;
  height: 5px;
  background: #E91E63;
  border-radius: 50%;
  top: 9px;
  animation: catBlink 3s infinite 0.5s;
}
.rabbit .eye-l { left: 7px; }
.rabbit .eye-r { right: 7px; }
.rabbit .nose {
  position: absolute;
  width: 4px;
  height: 3px;
  background: #FFB6C1;
  border-radius: 50%;
  top: 15px;
  left: 50%;
  transform: translateX(-50%);
  animation: rabbitNose 1.5s ease-in-out infinite;
}
.rabbit .cheek {
  position: absolute;
  width: 6px;
  height: 4px;
  background: #FFB6C1;
  border-radius: 50%;
  top: 16px;
  opacity: 0.5;
}
.rabbit .cheek-l { left: 2px; }
.rabbit .cheek-r { right: 2px; }
@keyframes rabbitEarL {
  0%, 100% { transform: rotate(-10deg); }
  50% { transform: rotate(-18deg); }
}
@keyframes rabbitEarR {
  0%, 100% { transform: rotate(10deg); }
  50% { transform: rotate(18deg); }
}
@keyframes rabbitNose {
  0%, 100% { transform: translateX(-50%) scale(1); }
  50% { transform: translateX(-50%) scale(1.3); }
}

/* ======================== BEAR ======================== */
.bear {
  position: relative;
  width: 36px;
  height: 34px;
}
.bear .ear {
  position: absolute;
  width: 10px;
  height: 10px;
  background: #8B5E3C;
  border-radius: 50%;
  top: -3px;
}
.bear .ear::after {
  content: '';
  position: absolute;
  width: 6px;
  height: 6px;
  background: #D4A574;
  border-radius: 50%;
  top: 2px;
  left: 2px;
}
.bear .ear-l { left: 1px; }
.bear .ear-r { right: 1px; }
.bear .face {
  width: 36px;
  height: 32px;
  background: #8B5E3C;
  border-radius: 50%;
  position: relative;
  margin-top: 2px;
}
.bear .eye {
  position: absolute;
  width: 4px;
  height: 4px;
  background: #333;
  border-radius: 50%;
  top: 11px;
  animation: catBlink 4.5s infinite 1s;
}
.bear .eye-l { left: 8px; }
.bear .eye-r { right: 8px; }
.bear .snout {
  position: absolute;
  width: 14px;
  height: 10px;
  background: #D4A574;
  border-radius: 50%;
  bottom: 5px;
  left: 50%;
  transform: translateX(-50%);
}
.bear .nose {
  width: 5px;
  height: 3px;
  background: #333;
  border-radius: 50% 50% 40% 40%;
  margin: 2px auto 0;
}
.bear {
  animation: bearBob 2s ease-in-out infinite;
}
@keyframes bearBob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}

/* ======================== FROG ======================== */
.frog {
  position: relative;
  width: 38px;
  height: 32px;
}
.frog .eye-bump {
  position: absolute;
  width: 12px;
  height: 12px;
  background: #4CAF50;
  border-radius: 50%;
  top: 0;
}
.frog .eye-bump-l { left: 4px; }
.frog .eye-bump-r { right: 4px; }
.frog .eye-bump .eye {
  width: 6px;
  height: 6px;
  background: #fff;
  border-radius: 50%;
  margin: 2px auto;
  position: relative;
  box-shadow: inset -2px 0 0 #333;
  animation: catBlink 3s infinite 0.3s;
}
.frog .face {
  width: 36px;
  height: 24px;
  background: #4CAF50;
  border-radius: 50%;
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
}
.frog .mouth {
  position: absolute;
  width: 20px;
  height: 6px;
  border-bottom: 2px solid #2E7D32;
  border-radius: 0 0 50% 50%;
  bottom: 6px;
  left: 50%;
  transform: translateX(-50%);
}
.frog .cheek {
  position: absolute;
  width: 6px;
  height: 4px;
  background: #FFB6C1;
  border-radius: 50%;
  bottom: 8px;
  opacity: 0.5;
}
.frog .cheek-l { left: 2px; }
.frog .cheek-r { right: 2px; }
.frog {
  animation: frogBounce 1.8s ease-in-out infinite;
}
@keyframes frogBounce {
  0%, 100% { transform: translateY(0) scaleY(1); }
  40% { transform: translateY(-5px) scaleY(1.05); }
  60% { transform: translateY(0) scaleY(0.95); }
}

/* ======================== CHICK ======================== */
.chick {
  position: relative;
  width: 32px;
  height: 34px;
}
.chick .body {
  width: 30px;
  height: 28px;
  background: #FFD54F;
  border-radius: 50%;
  position: relative;
  margin-top: 4px;
}
.chick .eye {
  position: absolute;
  width: 4px;
  height: 4px;
  background: #333;
  border-radius: 50%;
  top: 8px;
  animation: catBlink 2.8s infinite;
}
.chick .eye-l { left: 6px; }
.chick .eye-r { right: 6px; }
.chick .beak {
  position: absolute;
  width: 6px;
  height: 4px;
  background: #FF9800;
  top: 13px;
  left: 50%;
  transform: translateX(-50%);
  clip-path: polygon(0 0, 100% 0, 50% 100%);
}
.chick .cheek {
  position: absolute;
  width: 5px;
  height: 3px;
  background: #FFAB91;
  border-radius: 50%;
  top: 14px;
  opacity: 0.6;
}
.chick .cheek-l { left: 1px; }
.chick .cheek-r { right: 1px; }
.chick .wing {
  position: absolute;
  width: 8px;
  height: 10px;
  background: #FFC107;
  border-radius: 50%;
  right: -3px;
  top: 10px;
  transform-origin: top center;
  animation: chickWing 0.6s ease-in-out infinite;
}
.chick {
  animation: chickHop 1s ease-in-out infinite;
}
@keyframes chickWing {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(-20deg); }
}
@keyframes chickHop {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

/* ======================== PANDA ======================== */
.panda {
  position: relative;
  width: 36px;
  height: 34px;
}
.panda .ear {
  position: absolute;
  width: 10px;
  height: 10px;
  background: #333;
  border-radius: 50%;
  top: -2px;
}
.panda .ear-l { left: 1px; }
.panda .ear-r { right: 1px; }
.panda .face {
  width: 34px;
  height: 30px;
  background: #F5F5F5;
  border-radius: 50%;
  position: relative;
  margin-top: 4px;
}
.panda .eye-patch {
  position: absolute;
  width: 10px;
  height: 9px;
  background: #333;
  border-radius: 50%;
  top: 8px;
  transform: rotate(-5deg);
}
.panda .eye-patch-l { left: 4px; }
.panda .eye-patch-r { right: 4px; transform: rotate(5deg); }
.panda .eye-patch .eye {
  width: 4px;
  height: 4px;
  background: #fff;
  border-radius: 50%;
  margin: 3px auto 0;
  animation: catBlink 3.5s infinite 0.8s;
}
.panda .nose {
  position: absolute;
  width: 5px;
  height: 3px;
  background: #333;
  border-radius: 50%;
  top: 18px;
  left: 50%;
  transform: translateX(-50%);
}
.panda .mouth {
  position: absolute;
  width: 8px;
  height: 3px;
  border-bottom: 1.5px solid #555;
  border-radius: 0 0 50% 50%;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
}
.panda {
  animation: bearBob 2.5s ease-in-out infinite;
}
</style>
