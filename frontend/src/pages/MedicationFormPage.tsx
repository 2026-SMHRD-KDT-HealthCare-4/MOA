import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft, Minus, Plus, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { CycleType, MedicationInput, Weekday, useMedicationStore } from "../stores/medicationStore";
import * as Notifications from "expo-notifications";

const WEEKDAYS: { key: Weekday; label: string }[] = [
  { key: "MON", label: "월" }, { key: "TUE", label: "화" }, { key: "WED", label: "수" }, { key: "THU", label: "목" }, { key: "FRI", label: "금" }, { key: "SAT", label: "토" }, { key: "SUN", label: "일" },
];
const today = new Date().toISOString().slice(0, 10);

export default function MedicationFormPage() {
  const router = useRouter(); 
  const insets = useSafeAreaInsets(); 
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const resolvedId = Array.isArray(id) ? id[0] : id;
  const item = useMedicationStore((s) => s.medications.find((m) => m.id === resolvedId)); 
  const add = useMedicationStore((s) => s.addMedication); 
  const update = useMedicationStore((s) => s.updateMedication); 
  const deleteMedication = useMedicationStore((s) => s.deleteMedication); 
  const setNotificationId = useMedicationStore((s) => s.setNotificationId);
  const [name, setName] = useState(item?.medicineName ?? ""); 
  const [cycle, setCycle] = useState<CycleType>(item?.scheduleType ?? item?.cycleType ?? "daily"); 
  const [days, setDays] = useState<Weekday[]>(item?.daysOfWeek ?? []); 
  const [times, setTimes] = useState<string[]>(item?.times?.length ? item.times : ["08:00"]); 
  const [doseMode, setDoseMode] = useState<"1" | "2" | "3" | "custom">(item?.times.length === 1 ? "1" : item?.times.length === 2 ? "2" : item?.times.length === 3 ? "3" : "custom"); 
  const [startDate, setStartDate] = useState(item?.startDate ?? today); const [endDate, setEndDate] = useState(item?.endDate ?? ""); 
  const [enabled, setEnabled] = useState(item?.isActive ?? true);
  useEffect(() => {
    console.log("medication form", { id: resolvedId, item });
    if (!item) return;
    setName(item.medicineName); setCycle(item.scheduleType ?? item.cycleType); setDays(item.daysOfWeek ?? []); setTimes(item.times?.length ? item.times : [item.scheduledTime]); setDoseMode(item.times.length === 1 ? "1" : item.times.length === 2 ? "2" : item.times.length === 3 ? "3" : "custom"); setStartDate(item.startDate); setEndDate(item.endDate ?? ""); setEnabled(item.isActive);
  }, [resolvedId, item]);
  const setCount = (count: number) => setTimes((current) => Array.from({ length: count }, (_, index) => current[index] ?? (index === 1 ? "13:00" : index === 2 ? "20:00" : "08:00")));
  const chooseDose = (mode: "1" | "2" | "3" | "custom") => { setDoseMode(mode); if (mode !== "custom") setCount(Number(mode)); };
  const setSchedule = (next: CycleType) => { setCycle(next); if (next === "weekly" && days.length !== 1) setDays(["WED"]); if (next === "daily") setDays([]); };
  const toggleDay = (day: Weekday) => setDays((current) => cycle === "weekly" ? [day] : current.includes(day) ? current.filter((value) => value !== day) : [...current, day]);
  const save = async () => {
    if (!name.trim() || !times.length || times.some((time) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) 
      return Alert.alert("입력 확인", "약 이름과 시간을 08:00 형식으로 입력해주세요.");
    if ((cycle === "weekly" || cycle === "custom_days") && !days.length) 
      return Alert.alert("요일 선택", "복용할 요일을 선택해주세요.");
    const input: MedicationInput = { medicineName: name.trim(), cycleType: cycle, scheduleType: cycle, daysOfWeek: days, times, startDate, endDate: endDate || null, isActive: enabled };
    if (item) update(item.id, input);
     else { const medicationId = add(input); 
      if (enabled && cycle === "daily") { try { const permission = await Notifications.requestPermissionsAsync(); 
        if (permission.granted) 
          { const ids = await Promise.all(times.map((time) => { 
            const [hour, minute] = time.split(":").map(Number); 
            return Notifications.scheduleNotificationAsync({ 
              content: { title: "복약 알림", body: "약 드실 시간이에요.", 
                data: { localMedicationId: medicationId, medicationPrompt: "약 드셨나요?" } }, 
                trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute } }); })); 
                setNotificationId(medicationId, ids[0]); } } catch {} } }
    router.replace("/health");
  };
  const confirmDeleteMedication = (id: string) => {
  if (Platform.OS === "web") {
    const ok = window.confirm(
      "정말 삭제할까요?\n이 약 정보를 삭제하면 되돌릴 수 없어요."
    );

    if (!ok) return;

    deleteMedication(id);
    router.replace("/health");
    return;
  }

  Alert.alert(
    "정말 삭제할까요?",
    "이 약 정보를 삭제하면 되돌릴 수 없어요.",
    [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: () => {
          deleteMedication(id);
          router.replace("/health");
        },
      },
    ]
  );
};
  return <View style={[styles.fill,{paddingTop:insets.top}]}>
    <LinearGradient colors={["#F7D6AC","#FFF2DE","#F7D6AC"]} style={StyleSheet.absoluteFill}/>
    <View style={styles.header}>
      <TouchableOpacity onPress={()=>router.replace("/health")} style={styles.iconButton}>
        <ArrowLeft color="#3B2318" size={25}/></TouchableOpacity>
        <Text style={styles.headerTitle}>{item ? "약 정보" : "약 추가"}</Text>{item ? <TouchableOpacity onPress={() => item && confirmDeleteMedication(item.id)}>
          <Text style={styles.delete}>삭제</Text></TouchableOpacity> : <TouchableOpacity onPress={()=>void save()}>
            <Text style={styles.saveTop}>저장</Text></TouchableOpacity>}</View>
            <ScrollView contentContainerStyle={[styles.body,{paddingBottom:insets.bottom+30}]}>
    <Field label="약 이름">
      <TextInput value={name} onChangeText={setName} placeholder="예) 혈압약" placeholderTextColor="#A8968D" style={styles.input}/></Field>
    <Field label="복용 주기">
      <View style={styles.optionRow}>{([['daily','매일'],['weekly','주 1회'],['custom_days','특정 요일']] as [CycleType,string][]).map(([value,label])=><TouchableOpacity key={value} onPress={()=>setSchedule(value)} style={[styles.option,cycle===value&&styles.optionActive]}>
        <Text style={[styles.optionText,cycle===value&&styles.optionTextActive]}>{label}</Text></TouchableOpacity>)}</View></Field>
    {cycle !== "daily" && <Field label={cycle === "weekly" ? "복용 요일" : "복용할 요일을 모두 선택하세요"}>
      <View style={styles.dayRow}>{WEEKDAYS.map((day)=><TouchableOpacity key={day.key} onPress={()=>toggleDay(day.key)} style={[styles.dayButton,days.includes(day.key)&&styles.dayButtonActive]}>
        <Text style={[styles.dayText,days.includes(day.key)&&styles.dayTextActive]}>{day.label}</Text></TouchableOpacity>)}</View></Field>}
    <Field label="하루 복용 횟수">
      <View style={styles.doseRow}>{([['1','1회'],['2','2회'],['3','3회'],['custom','직접 입력']] as const).map(([value,label])=><TouchableOpacity key={value} onPress={()=>chooseDose(value)} style={[styles.doseButton,doseMode===value&&styles.optionActive]}>
        <Text style={[styles.optionText,doseMode===value&&styles.optionTextActive]}>{label}</Text></TouchableOpacity>)}</View></Field>
    <Field label="복용 시간">{times.map((time,index)=><View key={`${time}-${index}`} style={styles.timeRow}>
      <TextInput value={time} onChangeText={(value)=>setTimes(current=>current.map((t,i)=>i===index?value:t))} placeholder="08:00" keyboardType="numbers-and-punctuation" style={[styles.input,styles.timeInput]}/>{doseMode === "custom" ? <TouchableOpacity disabled={times.length===1} onPress={()=>setTimes(current=>current.filter((_,i)=>i!==index))} style={styles.removeTime}><X color={times.length===1?"#CFC2BB":"#A85D46"}/></TouchableOpacity> : null}</View>)}{doseMode === "custom" && <TouchableOpacity onPress={()=>setTimes(current=>[...current,"08:00"])} style={styles.addTime}><Plus color="#795035" size={19}/><Text style={styles.addTimeText}>시간 추가하기</Text></TouchableOpacity>}</Field>
    <Field label="복용 시작일">
      <TextInput value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" style={styles.input}/></Field>
    <Field label="복용 종료일 (선택)">
      <TextInput value={endDate} onChangeText={setEndDate} placeholder="종료일이 없으면 비워두세요" placeholderTextColor="#A8968D" keyboardType="numbers-and-punctuation" style={styles.input}/></Field>
    <View style={styles.noticeRow}><View>
      <Text style={styles.noticeTitle}>알림 활성화</Text>
      <Text style={styles.noticeSub}>설정한 시간에 알림을 보내드려요.</Text></View>
      <Switch value={enabled} onValueChange={setEnabled} trackColor={{false:"#E5D8D1",true:"#173F73"}} thumbColor="white"/></View><TouchableOpacity onPress={()=>void save()} style={styles.saveButton}><Text style={styles.saveButtonText}>저장</Text></TouchableOpacity>
  </ScrollView></View>;
}
function Field({label,children}:{label:string;children:ReactNode}){return <View style={styles.field}><Text style={styles.label}>{label}</Text>{children}</View>}
const styles=StyleSheet.create({fill:{flex:1},header:{height:70,paddingHorizontal:18,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},iconButton:{width:46,height:46,alignItems:"center",justifyContent:"center"},headerTitle:{fontSize:22,fontWeight:"900",color:"#3F2A1D"},saveTop:{fontSize:18,fontWeight:"900",color:"#173F73"},delete:{fontSize:18,fontWeight:"900",color:"#E45D55"},body:{padding:20,gap:18},field:{gap:9},label:{fontSize:19,fontWeight:"900",color:"#3F2A1D"},input:{height:56,backgroundColor:"#FFF9F1",borderWidth:1,borderColor:"rgba(94,65,40,0.12)",borderRadius:15,paddingHorizontal:15,fontSize:18,fontWeight:"700",color:"#3F2A1D"},optionRow:{flexDirection:"row",gap:7},option:{flex:1,minHeight:50,borderRadius:14,backgroundColor:"rgba(255,249,241,0.8)",alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:"rgba(94,65,40,0.12)",paddingHorizontal:4},optionActive:{backgroundColor:"#173F73",borderColor:"#173F73"},optionText:{fontSize:15,fontWeight:"900",color:"#6F5A49"},optionTextActive:{color:"white"},dayRow:{flexDirection:"row",gap:6,flexWrap:"wrap"},dayButton:{width:44,height:48,borderRadius:14,borderWidth:1,borderColor:"rgba(94,65,40,0.12)",backgroundColor:"#FFF9F1",alignItems:"center",justifyContent:"center"},dayButtonActive:{backgroundColor:"#173F73",borderColor:"#173F73"},dayText:{fontSize:17,fontWeight:"900",color:"#6F5A49"},dayTextActive:{color:"white"},doseRow:{flexDirection:"row",gap:7},doseButton:{flex:1,minHeight:52,borderRadius:14,backgroundColor:"#FFF9F1",alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:"rgba(94,65,40,0.12)",paddingHorizontal:3},timeRow:{flexDirection:"row",gap:8,marginBottom:7},timeInput:{flex:1},removeTime:{width:56,borderRadius:15,backgroundColor:"#FBE8E5",alignItems:"center",justifyContent:"center"},addTime:{height:48,borderRadius:14,borderWidth:1,borderColor:"#173F73",borderStyle:"dashed",alignItems:"center",justifyContent:"center",flexDirection:"row",gap:5},addTimeText:{fontSize:17,fontWeight:"900",color:"#173F73"},noticeRow:{backgroundColor:"#FFF9F1",borderRadius:18,padding:16,flexDirection:"row",justifyContent:"space-between",alignItems:"center"},noticeTitle:{fontSize:18,fontWeight:"900",color:"#3F2A1D"},noticeSub:{fontSize:14,fontWeight:"700",color:"#6F5A49",marginTop:4},saveButton:{height:60,borderRadius:18,backgroundColor:"#173F73",alignItems:"center",justifyContent:"center",marginTop:4},saveButtonText:{fontSize:20,fontWeight:"900",color:"white"}});
