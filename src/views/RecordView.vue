<template>
  <div class="record-screen">
    <div class="header">
      <h2>战斗记录</h2>
    </div>
    
    <div class="record-list" v-if="records.length > 0">
      <div class="record-card" v-for="record in reversedRecords" :key="record.id">
        <div class="record-info">
          <div class="time">{{ formatDate(record.timestamp) }}</div>
          <div class="duration">时长: {{ record.duration }}s</div>
        </div>
        <div class="versus">
          <div class="hero-info" :style="{ color: record.p1.color }">
            {{ record.p1.name }}
            <span class="result-badge" :class="getResultClass(record, 1)">{{ getResultText(record, 1) }}</span>
          </div>
          <div class="vs-text">VS</div>
          <div class="hero-info" :style="{ color: record.p2.color }">
            <span class="result-badge" :class="getResultClass(record, 2)">{{ getResultText(record, 2) }}</span>
            {{ record.p2.name }}
          </div>
        </div>
        <button class="replay-btn" @click="playReplay(record)">回放对局</button>
      </div>
    </div>
    <div class="empty-state" v-else>
      <p>暂无战斗记录，去打一场吧！</p>
    </div>
    
    <div class="footer">
      <button @click="router.push('/')" class="back-btn">返回选人</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { BattleRecordManager } from '../utils/BattleRecordManager.js';
import { useGameStore } from '../store/gameStore.js';

const router = useRouter();
const store = useGameStore();
const records = ref(BattleRecordManager.getRecords());

const reversedRecords = computed(() => [...records.value].reverse());

const formatDate = (timestamp) => {
  const d = new Date(timestamp);
  return `${d.getMonth()+1}-${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
};

const getResultClass = (record, pId) => {
  if (record.winner === 'draw') return 'draw';
  return record.winner === pId ? 'win' : 'lose';
};

const getResultText = (record, pId) => {
  if (record.winner === 'draw') return '平';
  return record.winner === pId ? '胜' : '败';
};

const heroNameClassMap = {
  '吸血鬼': 'Vampire',
  '蜘蛛': 'Spider',
  '狂战士': 'Berserker',
  '赌徒': 'Gambler',
  '马老师': 'MaLaoshi',
  '华强': 'HuaQiang',
  '成都之心': 'Van',
  '猴哥': 'SunWukong'
};

const getHeroClass = (recordClass, heroName) => {
  const validClasses = ['Vampire', 'Spider', 'Berserker', 'Gambler', 'MaLaoshi', 'HuaQiang', 'Van', 'SunWukong'];
  if (validClasses.includes(recordClass)) {
    return recordClass;
  }
  return heroNameClassMap[heroName] || recordClass;
};

const playReplay = (record) => {
  // Setup store for replay
  // 修复因代码压缩混淆导致旧记录 class 丢失的问题
  const p1Class = getHeroClass(record.p1.class, record.p1.name);
  const p2Class = getHeroClass(record.p2.class, record.p2.name);

  store.p1Selection = { class: p1Class, name: record.p1.name, color: record.p1.color };
  store.p2Selection = { class: p2Class, name: record.p2.name, color: record.p2.color };
  store.isTraining = false;
  
  router.push({ name: 'battle', query: { replayId: record.id } });
};
</script>

<style scoped>
.record-screen {
  width: 100%;
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #1a1a2e;
  color: white;
  padding: 20px;
  box-sizing: border-box;
}

.header {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 30px;
}

.header h2 {
  margin: 0;
  color: #fbd73a;
  text-shadow: 0 0 10px rgba(251,215,58,0.5);
}

.back-btn {
  background: #f0c710d5;
  color: white;
  border: none;
  padding: 12px 40px;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: bold;
  cursor: pointer;
  transition: 0.2s;
}

.back-btn:hover {
  background: #666;
}

.footer {
  margin-top: auto;
  display: flex;
  justify-content: center;
  padding-top: 20px;
}

.record-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
  overflow-y: auto;
  flex: 1;
}

.record-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 15px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.record-info {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 0.9rem;
  color: #aaa;
  width: 120px;
}

.versus {
  display: flex;
  align-items: center;
  gap: 20px;
  flex: 1;
  justify-content: center;
  font-size: 1.2rem;
  font-weight: bold;
}

.hero-info {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 150px;
}

.hero-info:first-child {
  justify-content: flex-end;
}

.result-badge {
  font-size: 0.8rem;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: bold;
}

.result-badge.win { background: #4caf50; color: white; }
.result-badge.lose { background: #f44336; color: white; }
.result-badge.draw { background: #9e9e9e; color: white; }

.vs-text {
  color: #888;
  font-size: 1.3rem;
}

.replay-btn {
  background: #2196F3;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  transition: 0.2s;
}

.replay-btn:hover {
  background: #1976D2;
}

.empty-state {
  text-align: center;
  color: #888;
  margin-top: 50px;
  font-size: 1.2rem;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .record-screen {
    padding: 10px;
  }

  .header {
    margin-bottom: 15px;
  }

  .record-card {
    flex-direction: column;
    gap: 15px;
    padding: 15px;
  }

  .record-info {
    width: 100%;
    flex-direction: row;
    justify-content: space-between;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding-bottom: 10px;
  }

  .versus {
    width: 100%;
    gap: 10px;
    font-size: 1rem;
  }

  .hero-info {
    width: 45%;
    gap: 5px;
    font-size: 1.3rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .hero-info:first-child {
    justify-content: center;
  }

  .replay-btn {
    width: 100%;
    padding: 12px;
    font-size: 1rem;
  }

  .back-btn {
    width: 100%;
    padding: 12px;
  }
}
</style>