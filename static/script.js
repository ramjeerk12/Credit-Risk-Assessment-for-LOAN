const form=document.querySelector('#loanForm'),btn=document.querySelector('#predictBtn'),errorBox=document.querySelector('#error');
const progress=document.querySelector('#progress'),amount=document.querySelector('#loanAmount'),income=form.elements.person_income,ratio=document.querySelector('#loanRatio');
function updateProgress(){const f=[...form.querySelectorAll('input,select')];progress.style.width=(f.filter(x=>x.value.trim()).length/f.length*100)+'%'}
form.addEventListener('input',updateProgress);form.addEventListener('change',updateProgress);
function autoRatio(){if(+amount.value>0&&+income.value>0)ratio.value=(+amount.value/+income.value).toFixed(3);updateProgress()}
amount.addEventListener('input',autoRatio);income.addEventListener('input',autoRatio);
function loading(v){btn.classList.toggle('loading',v);btn.disabled=v;btn.querySelector('.btn-text').textContent=v?'Assessing application':'Run risk assessment'}
function error(msg){errorBox.textContent=msg;errorBox.classList.add('show')}
function pct(n){return (n*100).toFixed(1)+'%'}
function render(d){
 const p=Number(d.default_probability),t=Number(d.threshold),prediction=Number(d.default_prediction);
 if(!Number.isFinite(p)||!Number.isFinite(t)||![0,1].includes(prediction))throw Error('Unexpected API response. Verify the /predict response fields.');
 const high=prediction===1,head=document.querySelector('.risk-head'),bar=document.querySelector('#probBar');
 head.classList.toggle('high',high);document.querySelector('#riskStatus').textContent=high?'HIGH RISK':'LOW RISK';
 document.querySelector('#riskTitle').textContent=high?'Elevated risk profile':'Lower risk profile';document.querySelector('#riskIcon').textContent=high?'!':'✓';
 document.querySelector('#probValue').textContent=pct(p);document.querySelector('#thresholdValue').textContent=pct(t);
 document.querySelector('#metricThreshold').textContent=pct(t);document.querySelector('#metricDecision').textContent=high?'High Risk':'Low Risk';
 bar.classList.toggle('high',high);bar.style.width='0%';document.querySelector('#thresholdMarker').style.left=Math.max(0,Math.min(100,t*100))+'%';
 document.querySelector('#decisionNote').innerHTML=high?'<strong>At or above the model threshold.</strong> The estimated probability meets or exceeds the configured cutoff. Review the application and supporting information before making any decision.':'<strong>Below the model threshold.</strong> The estimated probability is below the configured cutoff. This is a model estimate, not a guarantee of repayment.';
 document.querySelector('#empty').classList.add('hidden');document.querySelector('#result').classList.remove('hidden');
 requestAnimationFrame(()=>requestAnimationFrame(()=>bar.style.width=Math.max(0,Math.min(100,p*100))+'%'));
 document.querySelector('.result-panel').scrollIntoView({behavior:'smooth',block:'nearest'});
}
form.addEventListener('submit',async e=>{
 e.preventDefault();errorBox.classList.remove('show');if(!form.reportValidity())return;
 const f=new FormData(form),data={
 person_age:Number(f.get('person_age')),person_income:Number(f.get('person_income')),person_home_ownership:f.get('person_home_ownership'),
 person_emp_length:Number(f.get('person_emp_length')),loan_intent:f.get('loan_intent'),loan_grade:f.get('loan_grade'),
 loan_amnt:Number(f.get('loan_amnt')),loan_int_rate:Number(f.get('loan_int_rate')),loan_percent_income:Number(f.get('loan_percent_income')),
 cb_person_default_on_file:f.get('cb_person_default_on_file'),cb_person_cred_hist_length:Number(f.get('cb_person_cred_hist_length'))
 };
 if(data.person_income<=0||data.loan_amnt<=0){error('Income and loan amount must be greater than zero.');return}
 loading(true);
 try{const r=await fetch('/predict',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
 let d;try{d=await r.json()}catch{throw Error('Server returned an unreadable response.')}
 if(!r.ok)throw Error(typeof d.detail==='string'?d.detail:'Prediction request failed. Check the values and try again.');
 render(d);
 }catch(err){error(err.message||'Could not connect to the prediction API.')}finally{loading(false)}
});
document.querySelector('#resetBtn').addEventListener('click',()=>{form.reset();updateProgress();errorBox.classList.remove('show');document.querySelector('#result').classList.add('hidden');document.querySelector('#empty').classList.remove('hidden');document.querySelector('#probBar').style.width='0%';window.scrollTo({top:0,behavior:'smooth'})});
updateProgress();
