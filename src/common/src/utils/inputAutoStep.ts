/// <reference lib="dom" />
// Set automatic step control for an input element
import {GetDblPrecision, GetDblPrecision2, NormalizeDouble} from "wenay-common2";

interface IStepInputElement extends HTMLElement {
	value: string;
	step: string;
	min: string;
	max: string;
}

// step is a power of 0.1 (0.1, 0.01, ...) - resilient to float noise,
// unlike the previous Math.log10(step)%1==0
function isPowerOfTenth(step: number) {
	if (!(step > 0 && step < 1)) return false;
	const digits = Math.round(-Math.log10(step));
	return Math.abs(Math.pow(0.1, digits) - step) < step * 1e-9;
}

// Own handlers on the element: repeated calls remove previous ones (like the old on* overwrite)
const appliedHandlers = new WeakMap<HTMLElement, () => void>();

export function SetAutoStepForElement(element: IStepInputElement, params :{minStep? :number|undefined, maxStep? :number} = { maxStep: 1})
{
	appliedHandlers.get(element)?.();
	function parse(valueStr :string) { let val= parseFloat(valueStr);  return isNaN(val) ? null : val; }
    const {minStep, maxStep=1} = params;
    const maxDigits= minStep ? GetDblPrecision(minStep) : undefined;
	const stepDefault= parse(element.step);
	const minDefault= parse(element.min);
	const maxDefault= parse(element.max);
    const minDigits= maxStep>0 ? Math.max(0, -Math.round(Math.log10(maxStep))) : 0;
	let _digits :number|null= null;
	let _step= parse(element.step);
	let _min= parse(element.min);

	function calculateStep(valueStr :string) {
		//function NormalizeDouble(value :number, digits :number) { let factor=Math.pow(10, digits); return Math.round(value * factor)/factor;  }
		//if (dotPos===valueStr.length-1) dotPos--;
		//let digits= GetDblPrecision2(parseFloat(valueStr), minDigits, 10);
        let dotPos= valueStr.search(/\.|,/);  // Find a dot or comma
		let digits = (dotPos>=0) ?  valueStr.length - dotPos - 1  : 0;
        digits= Math.max(digits, minDigits);
        if (digits>10) digits= GetDblPrecision2(parseFloat(valueStr), minDigits, 10);
        if (maxDigits!=null) digits= Math.min(digits, maxDigits);
		let step= NormalizeDouble(Math.pow(0.1, digits), digits);
        if (minStep) step = NormalizeDouble(Math.round(step/minStep) * minStep, digits);
		if (maxDefault!=null && minDefault!=null)
			if (maxDefault - minDefault < step*2)
				return _step;
		_digits= digits;
		_step= step;
		//if (Math.abs(min) < step) min= Math.floor(Math.abs(min)/step)*step * Math.sign(min);
		if (_min!=null) {
			if (Math.abs(_min) % step !=0)
				_min= Math.floor(Math.abs(_min)/step) * step * Math.sign(_min);
			element.min= _min+"";
		}
		element.step= step+"";
		return step;
	}
	let modeAuto = !_step || isPowerOfTenth(_step);
	if (modeAuto) {
		calculateStep((_step ? (Math.round(parseFloat(element.value)/_step) *_step) : element.value)+"");
	}
    if (_step && minDefault && Math.abs(minDefault%_step) > 1e-10)
        modeAuto= false;
    else
    if (_step && maxDefault && Math.abs(maxDefault%_step) > 1e-10)
        modeAuto= false;
    else modeAuto ||= (_step!=null && (minStep==null || _step>minStep));

	// addEventListener instead of on*=: do not overwrite other handlers; return a disposer
	const onKeyUp = ()=>{ if (modeAuto) calculateStep(element.value); }

	const onChange = ()=> {
		let digits= _digits;  if (digits!=null)  element.value= parseFloat(element.value).toFixed(digits);
		if (minDefault!=null && parseFloat(element.value) < minDefault) {
			element.step = stepDefault+"";
			element.value= minDefault+"";
			element.min= minDefault+"";
			_digits= null;
		}
		element.setAttribute("value", element.value);
	}

	element.addEventListener("keyup", onKeyUp);
	element.addEventListener("change", onChange);
	const dispose = () => {
		element.removeEventListener("keyup", onKeyUp);
		element.removeEventListener("change", onChange);
		appliedHandlers.delete(element);
	};
	appliedHandlers.set(element, dispose);
	return dispose;
}

//import * as Time from "./Time"
//import {const_Date} from "./Time";





