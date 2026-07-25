export type Character = {
  id: string;
  name: string;
  reading: string;
  roleLabel: string;
  role: string;
  feature: string;
  consultation: string;
  image: string;
  alt: string;
  socials?: {
    x?: string;
    youtube?: string;
    instagram?: string;
  };
};

// キャラクターが未公開の間は空配列のままにしてください。
// 1人以上追加すると、Coming Soon表示からキャラクターカードへ自動で切り替わります。
export const characters: Character[] = [];

/* 追加時のサンプル
export const characters: Character[] = [
  {
    id: "tokyo-luna",
    name: "東京 ルナ",
    reading: "とうきょう るな",
    roleLabel: "相談コンシェルジュ",
    role: "東京の住まい探しを支えるVTuber相談員",
    feature: "明るく親しみやすく、希望条件を丁寧に整理",
    consultation: "賃貸・購入・エリア選び・オンライン相談",
    image: "/assets/images/character-profile.jpg",
    alt: "VTuber相談員 東京ルナ",
    socials: {
      x: "",
      youtube: "",
      instagram: "",
    },
  },
];
*/
