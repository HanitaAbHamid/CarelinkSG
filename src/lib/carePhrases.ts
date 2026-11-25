/**
 * Offline-Ready Verified Singapore Eldercare Phrase Deck
 * Zero latency, zero mobile data required — safe in HDB lifts & polyclinic basements.
 */

export interface CarePhrase {
  id: string;
  category: 'meds' | 'safety' | 'daily' | 'clinic';
  icon: string;
  en: string;
  idLang: string;
  ms: string;
  zh: string;
  ta: string;
  hokkien: { text: string; romanized: string };
  cantonese: { text: string; romanized: string };
  teochew: { text: string; romanized: string };
  tl: string;
}

export const OFFLINE_CARE_PHRASES: CarePhrase[] = [
  {
    id: 'take_meds',
    category: 'meds',
    icon: '💊',
    en: 'Time to take your medicine with warm water.',
    idLang: 'Waktunya minum obat dengan air hangat ya.',
    ms: 'Sudah masa makan ubat dengan air suam.',
    zh: '阿嬷，现在是吃药时间，喝点温水慢慢吞。',
    ta: 'வெந்நீருடன் மாத்திரை சாப்பிடும் நேரம் ஆகிவிட்டது.',
    hokkien: { text: '阿嬷，食药时间到了，配烧水慢慢吞。', romanized: 'Ah Ma, jiak yoh si-kan kau liao, phue sio-chui ban-ban thun.' },
    cantonese: { text: '婆婆，够钟食药喇，饮暖水慢慢吞。', romanized: 'Po po, gau zung sik joek laa, jam nyun seoi maan maan tan.' },
    teochew: { text: '阿嬷，食药时间到了，配烧水。', romanized: 'Ah Ma, jiah ieh si-kang gao liao, phoi sio-zui.' },
    tl: 'Oras na po para uminom ng gamot na may maligamgam na tubig.',
  },
  {
    id: 'feel_dizzy',
    category: 'safety',
    icon: '🌀',
    en: 'Do you feel dizzy? Stay seated and rest slowly.',
    idLang: 'Apakah merasa pusing? Duduk tenang dulu ya.',
    ms: 'Ada rasa pening? Duduk berehat perlahan-lahan dulu.',
    zh: '您觉得头晕吗？先坐着慢慢休息，别急着起身。',
    ta: 'தலை சுற்றுகிறதா? தயவுசெய்து உட்கார்ந்து ஓய்வெடுங்கள்.',
    hokkien: { text: '你会头晕无？先坐咧歇困，毋通紧起来。', romanized: 'Li eh thau-hin bo? Seng zeh leh hioh-khun, m-thang kin khi-lai.' },
    cantonese: { text: '你觉唔觉得头晕？坐低抖阵先。', romanized: 'Nei gok m gok dak tau wan? Co dai tau zan sin.' },
    teochew: { text: '汝会头晕无？先坐落歇一下。', romanized: 'Leu oi tao-hung bo? Seng zo loh hioh zek eh.' },
    tl: 'Nahihilo po ba kayo? Maupo muna po at magpahinga.',
  },
  {
    id: 'where_pain',
    category: 'safety',
    icon: '🩹',
    en: 'Where does it hurt? Please point for me.',
    idLang: 'Bagian mana yang sakit? Tolong tunjukkan ya.',
    ms: 'Bahagian mana yang sakit? Tolong tunjukkan.',
    zh: '哪里痛或不舒服？请指给我看。',
    ta: 'எங்கே வலிக்கிறது? தயவுசெய்து காட்டுங்கள்.',
    hokkien: { text: '佗位痛？指给我看。', romanized: 'Toh-ui thia? Ki hor gua khuann.' },
    cantonese: { text: '边度痛呀？指俾我睇。', romanized: 'Bin dou tung aa? Zi bei ngo tai.' },
    teochew: { text: '底块痛？指乞我睇。', romanized: 'Di-ko thia? Ki khe ua thoi.' },
    tl: 'Saan po masakit? Pakituro po sa akin.',
  },
  {
    id: 'check_bp',
    category: 'clinic',
    icon: '🩺',
    en: 'Let us sit quietly and check your blood pressure.',
    idLang: 'Mari duduk tenang dulu untuk cek tekanan darah.',
    ms: 'Mari duduk tenang, kita periksa tekanan darah.',
    zh: '我们先安静坐好，量一下血压。',
    ta: 'அமைதியாக உட்கார்ந்து இரத்த அழுத்தத்தை பார்ப்போம்.',
    hokkien: { text: '咱先坐好好，来量血压。', romanized: 'Lan seng zeh ho-ho, lai niu hueh-ap.' },
    cantonese: { text: '我哋坐定定，量一下血压。', romanized: 'Ngo dei co ding ding, loeng jat haa hyut aat.' },
    teochew: { text: '俺先坐好，来量血压。', romanized: 'Nang seng zo ho, lai nio hueh-ap.' },
    tl: 'Umupo muna tayo nang tahimik para sukatin ang presyon.',
  },
  {
    id: 'walk_slow',
    category: 'safety',
    icon: '🚶',
    en: 'Hold my arm firmly and walk slowly — floor may be slippery.',
    idLang: 'Pegang tangan saya erat-erat, jalan pelan ya, lantai bisa licin.',
    ms: 'Pegang tangan saya kuat-kuat, jalan perlahan, lantai mungkin licin.',
    zh: '扶稳我的手臂慢慢走，小心防滑。',
    ta: 'என் கையைப் பிடித்து மெதுவாக நடங்கள், தரை வழுக்கலாம்.',
    hokkien: { text: '牵好我的手慢慢行，小心滑。', romanized: 'Khan ho gua eh chiu ban-ban kiann, sio-sim kut.' },
    cantonese: { text: '扶实我只手慢慢行，小心滑。', romanized: 'Fu sat ngo zek sau maan maan haang, siu sam waat.' },
    teochew: { text: '牵好我个手慢慢行，小心滑。', romanized: 'Khang ho ua gai chiu mang-mang kiann.' },
    tl: 'Humawak po nang mahigpit sa braso ko at maglakad nang dahan-dahan.',
  },
  {
    id: 'drink_water',
    category: 'daily',
    icon: '🍵',
    en: 'Please drink some warm water so you do not get dehydrated.',
    idLang: 'Minum air hangat sedikit ya supaya tidak kurang cairan.',
    ms: 'Sila minum air suam sedikit supaya tidak kering tekak.',
    zh: '喝点温水润润喉，不要口渴了。',
    ta: 'தயவுசெய்து சிறிது வெந்நீர் குடியுங்கள்.',
    hokkien: { text: '喝一寡烧水，毋通口干。', romanized: 'Lim zit-kua sio-chui, m-thang chui-ta.' },
    cantonese: { text: '饮啲暖水啦，唔好口渴。', romanized: 'Jam di nyun seoi laa, m hou hau hot.' },
    teochew: { text: '饮淡薄烧水，莫嘴干。', romanized: 'Zim dam-poh sio-zui.' },
    tl: 'Uminom po muna ng kaunting maligamgam na tubig.',
  },
  {
    id: 'toilet_help',
    category: 'daily',
    icon: '🚻',
    en: 'Do you need to use the toilet? Wait for me, do not go alone.',
    idLang: 'Mau ke kamar mandi? Tunggu saya ya, jangan jalan sendiri.',
    ms: 'Nak ke tandas? Tunggu saya ya, jangan pergi sendiri.',
    zh: '要去洗手间吗？等我扶您，不要自己走。',
    ta: 'கழிப்பறைக்கு செல்ல வேண்டுமா? என்னைக் கூப்பிடுங்கள், தனியாக போகாதீர்கள்.',
    hokkien: { text: '要放尿无？等我牵你，毋通家己行。', romanized: 'Beh pang-jio bo? Tan gua khan li, m-thang ka-ki kiann.' },
    cantonese: { text: '要去厕所吗？等我扶你，唔好自己行。', romanized: 'Jiu heoi ci so maa? Dang ngo fu nei, m hou zi gei haang.' },
    teochew: { text: '爱去便所无？等我牵汝。', romanized: 'Ai khu piang-so bo? Dang ua khang leu.' },
    tl: 'Gusto po ba ninyong mag-CR? Hintayin po ako, huwag pong mag-isa.',
  },
  {
    id: 'breakfast_ready',
    category: 'daily',
    icon: '🥣',
    en: 'Breakfast is ready. Eat slowly so you do not choke.',
    idLang: 'Sarapan sudah siap. Makan pelan-pelan supaya tidak tersedak.',
    ms: 'Sarapan sudah siap. Makan perlahan supaya tidak tercekik.',
    zh: '早餐准备好了，慢慢吃不要呛到。',
    ta: 'காலை உணவு தயார். மெதுவாக சாப்பிடுங்கள்.',
    hokkien: { text: '早顿好了，慢慢食毋通呛着。', romanized: 'Za-tng ho liao, ban-ban jiak m-thang chhiunn-tioh.' },
    cantonese: { text: '早餐准备好喇，慢慢食唔好哽亲。', romanized: 'Zou caan zeon bei hou laa, maan maan sik m hou kang can.' },
    teochew: { text: '早顿好了，慢慢食。', romanized: 'Za-dng ho liao, mang-mang jiah.' },
    tl: 'Handa na po ang almusal. Kumain po nang dahan-dahan.',
  },
  {
    id: 'clinic_wait',
    category: 'clinic',
    icon: '🏥',
    en: 'We are at the polyclinic now. Let us wait for the doctor to call your queue number.',
    idLang: 'Kita sudah di poliklinik. Tunggu dokter panggil nomor antrean ya.',
    ms: 'Kita di poliklinik sekarang. Tunggu doktor panggil nombor giliran.',
    zh: '我们到综合诊疗所了，坐着等医生叫号。',
    ta: 'நாம் பாலிகிளினிக்கில் இருக்கிறோம். மருத்துவர் அழைக்கும் வரை காத்திருப்போம்.',
    hokkien: { text: '咱到诊疗所了，坐咧等医生叫号码。', romanized: 'Lan kau jin-liau-so liao, zeh leh tan ui-seng kio ho-be.' },
    cantonese: { text: '我哋到诊所喇，坐定等医生叫号。', romanized: 'Ngo dei dou can so laa, co ding dang ji sang giu hou.' },
    teochew: { text: '俺到诊所了，坐等医生叫号。', romanized: 'Nang gao jing-so liao, zo dang ui-seng gio ho.' },
    tl: 'Nandito na po tayo sa polyclinic. Hintayin natin ang tawag ng doktor.',
  },
  {
    id: 'call_family',
    category: 'safety',
    icon: '📞',
    en: 'Do not worry, I am calling your son / daughter right now.',
    idLang: 'Jangan khawatir, saya telepon anak Nenek sekarang ya.',
    ms: 'Jangan risau, saya telefon anak Nenek sekarang.',
    zh: '别担心，我现在立刻打电话给您孩子。',
    ta: 'கவலைப்படாதீர்கள், இப்போது உங்கள் மகன்/மகளை அழைக்கிறேன்.',
    hokkien: { text: '免烦恼，我现在马上敲电话给恁囝。', romanized: 'Bian huan-lo, gua jit-ma ma-siang kha tian-ue hor lin kiann.' },
    cantonese: { text: '唔使担心，我即刻打电话俾你仔女。', romanized: 'M sai daam sam, ngo zik hak daa din waa bei nei zai neoi.' },
    teochew: { text: '免烦恼，我现在打电话乞汝囝。', romanized: 'Miang huang-lo, ua hiang-zai pa diang-ue.' },
    tl: 'Huwag po kayong mag-alala, tatawagan ko po ang anak ninyo ngayon.',
  },
  {
    id: 'sugar_check',
    category: 'clinic',
    icon: '🩸',
    en: 'Small finger prick for blood sugar — just one second.',
    idLang: 'Cek gula darah sebentar di jari ya, cuma satu detik.',
    ms: 'Periksa gula darah di jari sekejap saja ya.',
    zh: '轻轻测一下手指血糖，一秒钟就好。',
    ta: 'சர்க்கரை பரிசோதனைக்கு விரலில் சிறிய குத்து — ஒரு வினாடி தான்.',
    hokkien: { text: '轻轻量一下手指血糖，一下仔就好。', romanized: 'Khin-khin niu zit-eh chiu-ji hueh-thng, zit-eh-a jiu ho.' },
    cantonese: { text: '笃手指测血糖，一秒就好喇。', romanized: 'Duk sau zi cak hyut tong, jat miu zau hou laa.' },
    teochew: { text: '量一下手指血糖，一下就好。', romanized: 'Nio zek eh chiu-zain hueh-theng.' },
    tl: 'Susukatin lang po ang blood sugar sa daliri, isang segundo lang po.',
  },
  {
    id: 'did_you_fall',
    category: 'safety',
    icon: '🚨',
    en: 'Do not move yet! Did you hit your head or hip? I will get help.',
    idLang: 'Jangan bergerak dulu! Kepala atau pinggul terbentur? Saya panggil bantuan.',
    ms: 'Jangan bergerak dulu! Kepala atau pinggul terhantuk? Saya panggil bantuan.',
    zh: '先别动！头或臀部有撞到吗？我马上叫人帮忙。',
    ta: 'இப்போது நகர வேண்டாம்! தலை அல்லது இடுப்பில் அடிபட்டதா? உதவி அழைக்கிறேன்.',
    hokkien: { text: '先毋通动！头抑是尻川有撞着无？我马上叫人来帮。', romanized: 'Seng m-thang tang! Thau ah-si kha-chng u long-tioh bo? Gua ma-siang kio lang.' },
    cantonese: { text: '唔好郁住！头或者盘骨有冇撞亲？我即刻叫人帮手。', romanized: 'M hou juk zyu! Tau waak ze pun gwat jau mou zong can?' },
    teochew: { text: '先莫动！头有撞着无？我马上叫人来。', romanized: 'Seng mai dang! Tao u dong tioh bo?' },
    tl: 'Huwag muna pong gumalaw! Tumama po ba ang ulo o balakang ninyo? Tatawag po ako ng tulong.',
  },
];

export const SPEECH_LANG_CODES: Record<string, string> = {
  en: 'en-SG',
  id: 'id-ID',
  ms: 'ms-MY',
  zh: 'zh-CN',
  ta: 'ta-IN',
  hokkien: 'zh-TW', // Closest available browser TTS voice fallback for Min Nan / Mandarin Hanzi
  cantonese: 'zh-HK',
  teochew: 'zh-TW',
  tl: 'fil-PH',
  my: 'my-MM',
};

export function speakText(text: string, langCode: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = SPEECH_LANG_CODES[langCode] || 'en-SG';
    utter.rate = 0.88; // Slightly slower & clearer for elderly listeners
    window.speechSynthesis.speak(utter);
  } catch {
    // Ignore browser speech errors gracefully
  }
}
