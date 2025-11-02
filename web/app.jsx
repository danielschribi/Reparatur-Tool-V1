import React, { useEffect, useMemo, useState } from 'https://esm.sh/react@18.3.1';
}


function DBDialog({open,onClose}){
if(!open) return null;
return (
<div className="fixed inset-0 bg-black/40 flex items-start justify-center pt-24">
<div className="bg-white w-[360px] rounded-xl shadow p-4">
<h2 className="text-lg font-bold mb-3">Datenbank</h2>
<div className="space-y-2">
<button onClick={onClose} className="w-full px-3 py-2 bg-gray-100 rounded">OK</button>
<button className="w-full px-3 py-2 bg-gray-100 rounded" onClick={()=>alert('Öffne Sheet: user (Editor)')}>User</button>
<button className="w-full px-3 py-2 bg-gray-100 rounded" onClick={()=>alert('Öffne Sheet: rollen (Editor)')}>Rollen</button>
</div>
</div>
</div>
);
}


function App(){
const [session,setSession]=useState(null); // {token, role, iduser, initials} ODER {needChange:true,...}
const [showLogin,setShowLogin]=useState(false);
const [showUser,setShowUser]=useState(false);
const [showDB,setShowDB]=useState(false);
const [showRegister,setShowRegister]=useState(false);


useEffect(()=>{
// Wenn niemand eingeloggt ist, Anmelde-Button unter Datum anzeigen → wir nutzen simple Logik
},[]);


const loggedIn = !!session?.token || session?.needChange || session?.iduser;


return (
<div>
<TopBar
session={session}
onAvatarClick={()=> setShowLogin(true)}
onHome={()=>{ setShowUser(false); setShowDB(false); setShowRegister(false); }}
onNewReport={()=> alert('Meldung erfassen (Dialog Platzhalter)')}
onOpenUser={()=> setShowUser(true)}
onOpenDB={()=> setShowDB(true)}
/>


{!loggedIn && (
<div className="pt-20 text-center">
<button className="mt-2 px-3 py-1 text-sm bg-white/80 rounded border" onClick={()=>setShowRegister(true)}>Anmeldung</button>
</div>
)}


{!showUser && <StartScreen/>}
{showUser && <UserMask session={session} open={showUser} onClose={()=>setShowUser(false)} />}
<DBDialog open={showDB} onClose={()=>setShowDB(false)} />
<RegisterMask open={showRegister} onClose={()=>setShowRegister(false)} />


<LoginDialog open={showLogin} onClose={()=>setShowLogin(false)} onLogged={(s)=>{ setSession(s); if(s.needChange){ alert('Bitte Passwort ändern (Klartext erkannt)'); } }} />
</div>
);
}


createRoot(document.getElementById('root')).render(<App/>);
