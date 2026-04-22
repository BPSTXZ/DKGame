const MAX_RECORDS = 5;
const STORAGE_KEY = 'dkgame_battle_records';

export const BattleRecordManager = {
    saveRecord(record) {
        let records = this.getRecords();
        records.push(record);
        if (records.length > MAX_RECORDS) {
            records.shift(); // 移除最旧的
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    },

    getRecords() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Failed to parse battle records', e);
            return [];
        }
    },

    getRecordById(id) {
        return this.getRecords().find(r => r.id === id);
    },

    clearRecords() {
        localStorage.removeItem(STORAGE_KEY);
    }
};