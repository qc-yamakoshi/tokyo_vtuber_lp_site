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

// 本格始動前は空配列のままにしてください。
// キャラクターを公開するときだけ、下のサンプルを配列内へ追加します。
export const characters: Character[] = [];

/*
{
  id: "character-01",
  name: "キャラクター名",
  reading: "よみがな",
  roleLabel: "相談コンシェルジュ",
  role: "担当する役割",
  feature: "キャラクターの特徴",
  consultation: "対応できる相談内容",
  image: "/assets/images/character-01.webp",
  alt: "VTuber相談員 キャラクター名",
  socials: {
    x: "",
    youtube: "",
    instagram: "",
  },
}
*/
