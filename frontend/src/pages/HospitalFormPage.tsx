import { Alert, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft } from "lucide-react-native";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useMedicationStore } from "../stores/medicationStore";
import { createHospitalVisit, updateHospitalVisit, deleteHospitalVisit } from "../api/hospital";
import { useAuthStore } from "../stores/authStore";
import { scheduleHospitalNotifications, cancelHospitalNotifications } from "../utils/notificationHelper";

export default function HospitalFormPage() {
  const router=useRouter(); 
  const insets=useSafeAreaInsets(); 
  const {id,reset}=useLocalSearchParams<{id?:string | string[]; reset?: string | string[]}>();
  const resolvedId = Array.isArray(id) ? id[0] : id;
  const resolvedReset = Array.isArray(reset) ? reset[0] : reset;
  const item=useMedicationStore(s=>s.hospitalSchedules.find(schedule=>schedule.id===resolvedId)); const add=useMedicationStore(s=>s.addHospitalSchedule); 
  const update=useMedicationStore(s=>s.updateHospitalSchedule); 
  const remove=useMedicationStore(s=>s.removeHospitalSchedule);
  const [hospitalName,setHospitalName]=useState(item?.hospitalName??""); 
  const [visitDate,setVisitDate]=useState(item?.visitDate??""); 
  const [visitTime,setVisitTime]=useState(item?.visitTime??""); 
  const [memo,setMemo]=useState(item?.memo??""); 
  const [enabled,setEnabled]=useState(item?.enabled??true);
  useEffect(() => {
    if (item) {
      setHospitalName(item.hospitalName);
      setVisitDate(item.visitDate);
      setVisitTime(item.visitTime);
      setMemo(item.memo ?? "");
      setEnabled(item.enabled);
    } else {
      setHospitalName("");
      setVisitDate("");
      setVisitTime("");
      setMemo("");
      setEnabled(true);
    }
  }, [resolvedId, resolvedReset]);
  const save = async () => {
    const trimmedTime = visitTime.trim();
    const formattedVisitTime = /^\d:[0-5]\d$/.test(trimmedTime) ? "0" + trimmedTime : trimmedTime;

    if (!hospitalName.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(visitDate) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(formattedVisitTime))
      return Alert.alert("입력 확인", "병원명, 방문일, 시간(08:00)을 입력해주세요.");
    
    // senior_id 조회
    const authUser = useAuthStore.getState().user;
    const seniorId = authUser?.seniorId || authUser?.uid || "";
    if (!seniorId) {
      return Alert.alert("오류", "고령층 정보를 확인할 수 없습니다.");
    }

    try {
      const input = { hospitalName: hospitalName.trim(), visitDate, visitTime: formattedVisitTime, memo: memo.trim() || undefined, enabled };
      if (item) {
        await updateHospitalVisit(item.id, {
          hospital_name: hospitalName.trim(),
          visit_date: visitDate,
          visit_time: formattedVisitTime,
          memo: memo.trim() || null,
          is_active: enabled,
        });
        update(item.id, input);
      } else {
        await createHospitalVisit(seniorId, hospitalName.trim(), visitDate, formattedVisitTime, memo.trim(), enabled);
        add(input);
      }
      router.replace("/health");
    } catch (err) {
      console.error("Failed to save hospital visit:", err);
      Alert.alert("저장 실패", "병원 일정을 저장하지 못했습니다.");
    }
  };

  const deleteItem = () => {
    if (!item) return;

    const performDelete = async () => {
      try {
        await deleteHospitalVisit(item.id);
        remove(item.id);
        router.replace("/health");
      } catch (err) {
        console.error("Failed to delete hospital visit:", err);
        Alert.alert("삭제 실패", "병원 일정을 삭제하지 못했습니다.");
      }
    };

    if (Platform.OS === "web") {
      const ok = window.confirm(
        "정말 삭제할까요?\n삭제하면 되돌릴 수 없어요."
      );
      if (ok) void performDelete();
      return;
    }

    Alert.alert(
      "정말 삭제할까요?",
      "삭제하면 되돌릴 수 없어요.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: () => {
            void performDelete();
          },
        },
      ]
    );
  };
  return <View style={[styles.fill,{paddingTop:insets.top}]}>
    <LinearGradient colors={["#F7D6AC","#FFF2DE","#F7D6AC"]} style={StyleSheet.absoluteFill}/>
    <View style={styles.header}><TouchableOpacity onPress={()=>router.replace("/health")} style={styles.back}>
      <ArrowLeft color="#3B2318" size={25}/></TouchableOpacity>
      <Text style={styles.headerTitle}>{item?"병원 일정":"병원 일정 추가"}</Text>{item?<TouchableOpacity onPress={deleteItem}>
        <Text style={styles.delete}>삭제</Text></TouchableOpacity>:<TouchableOpacity onPress={save}><Text style={styles.saveTop}>저장</Text></TouchableOpacity>}</View><ScrollView contentContainerStyle={[styles.body,{paddingBottom:insets.bottom+30}]}>
          <Field label="병원명">
            <TextInput value={hospitalName} onChangeText={setHospitalName} placeholder="예) 남양주 현대병원" placeholderTextColor="#A8968D" style={styles.input}/></Field>
            <Field label="방문일">
  <TextInput
    value={visitDate}
    onChangeText={setVisitDate}
    placeholder="2026-06-24"
    placeholderTextColor="#A8968D"
    keyboardType="numbers-and-punctuation"
    style={styles.input}
  />
</Field>

<Field label="시간">
  <TextInput
    value={visitTime}
    onChangeText={setVisitTime}
    placeholder="10:00"
    placeholderTextColor="#A8968D"
    keyboardType="numbers-and-punctuation"
    style={styles.input}
  />
</Field>

<Field label="메모">
                  <TextInput value={memo} onChangeText={setMemo} placeholder="메모를 입력하세요." placeholderTextColor="#A8968D" maxLength={100} multiline style={[styles.input,styles.memoInput]}/><Text style={styles.counter}>{memo.length}/100</Text></Field>
                  <View style={styles.notice}><View><Text style={styles.noticeTitle}>알림 설정</Text>
                  <Text style={styles.noticeSub}>방문 3일 전, 1일 전에 알려드려요.</Text></View>
                  <Switch value={enabled} onValueChange={setEnabled} trackColor={{false:"#E5D8D1",true:"#B97B51"}} thumbColor="white"/></View>
                  <TouchableOpacity onPress={save} style={styles.saveButton}>
                    <Text style={styles.saveButtonText}>저장</Text></TouchableOpacity></ScrollView></View>;
}
function Field({label,children}:{label:string;children:ReactNode}){return <View style={styles.field}><Text style={styles.label}>{label}</Text>{children}</View>}
const styles=StyleSheet.create({
  fill:{flex:1},
  header:{height:70,paddingHorizontal:18,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
  back:{width:46,height:46,alignItems:"center",justifyContent:"center"},
  headerTitle:{fontSize:22,fontWeight:"900",color:"#3B2318"},
  saveTop:{fontSize:18,fontWeight:"900",color:"#795035"},
  delete:{fontSize:18,fontWeight:"900",color:"#BF5946"},
  body:{padding:20,gap:18},
  field:{gap:9},
  label:{fontSize:19,fontWeight:"900",color:"#3B2318"},
  input:{minHeight:54,backgroundColor:"rgba(255,255,255,0.88)",borderWidth:1,borderColor:"#E2CFC0",borderRadius:15,paddingHorizontal:15,fontSize:18,fontWeight:"700",color:"#3B2318"},
  memoInput:{height:110,paddingTop:14,textAlignVertical:"top"},
  counter:{alignSelf:"flex-end",fontSize:13,fontWeight:"700",color:"#8E786D",marginTop:-4},
  notice:{backgroundColor:"rgba(255,255,255,0.82)",borderRadius:18,padding:16,flexDirection:"row",justifyContent:"space-between",alignItems:"center"},
  noticeTitle:{fontSize:18,fontWeight:"900",color:"#3B2318"},
  noticeSub:{fontSize:14,fontWeight:"700",color:"#765E52",marginTop:4},
  saveButton:{height:58,borderRadius:18,backgroundColor:"#795035",alignItems:"center",justifyContent:"center"},
  saveButtonText:{fontSize:20,fontWeight:"900",color:"white"},
  dateText:{fontSize:18,fontWeight:"800",color:"#3B2318"},
  datePlaceholder:{fontSize:18,fontWeight:"800",color:"#A8968D"},
});
