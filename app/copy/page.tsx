import { redirect } from 'next/navigation';
// 개편(2026-11): 이 화면은 '수련'으로 합쳐졌다
export default function Page() { redirect('/practice'); }
