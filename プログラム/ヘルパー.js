/*
These codes are licensed under CC0.
http://creativecommons.org/publicdomain/zero/1.0
*/


import * as DB from './データベース.js'


export const log	= console.log.bind( console )
export const info	= console.info.bind( console )
export const warn	= console.warn.bind( console )
export const error = console.error.bind( console )

export const Token = [ 'back' ].reduce( ( obj, key ) => { obj[ key ] = Symbol( ); return obj }, { } )


export function Deferred ( ) {
	let resolve, reject
	let promise = new Promise( ( ok, ng ) => { resolve = ok, reject = ng } )
	return { promise, resolve, reject }
}

export function timeout ( ms ) {

	let { promise, resolve } = new Deferred
	if ( ms != Infinity ) setTimeout( resolve, ms )
	return promise
}


export function AwaitRegister ( fn ) {

	let registrants = new Set

	return {

		target ( ...args ) {
			let v = fn( ...args )
			for ( let reg of registrants ) { reg( v ) }
			registrants.clear( )
			return v
		},

		register ( ) {
			let { promise, resolve } = new Deferred
			registrants.add( resolve )
			return promise
		}
	}

}


export function disableChoiceList ( disables, choiceList ) {
	for ( let choice of choiceList ) {
		if ( disables.includes( choice.label ) ) choice.disabled = true
	}
}


export async function getSaveChoices ( title, num, { isLoad = false } = { } ) {

	let stateList = await DB.getStateList( title )
	let choices = [ ...Array( num ).keys( ) ].map( i => {
		let index = i + 1, state = stateList[ index ]
		let mark = state ? state.mark || '???' : '--------'
		if ( mark == '$root' ) mark = '(冒頭)'
		let disabled　= ( isLoad && ! state ) || index > 20
		return { label: mark, value: index, disabled }
	} )
	return choices

}


export function parseSetting ( text ) {

	let setting = { }
	let key = ''

	for ( let chunk of text.split( '\n' ) ) {
		chunk = chunk.trim( )
		if ( !chunk ) continue
		if ( chunk.match( /^・/ ) ) {
			key = chunk.replace( '・', '' )
			setting[ key ] = [ ]
		} else {
			setting[ key ].push( chunk )
		}
	}

	log( setting )
	return setting
}


export function neverRun ( ) {
	return new Deferred( ).promise
}


export class Awaiter {

	fire ( key, value ) {

		if ( ! this[ key ] ) {
			this[ key ] = { lateValue: value }
			return
		}
		if ( this[ key ].lateValue ) {
			this[ key ].lateValue = value
		}
		if ( this[ key ].promise ) {
			this[ key ].resolve( value )
			delete this[ key ].promise
		}

	}

	on ( key, late = false ) {

		let { promise, resolve, lateValue } = this[ key ] || { }
		if ( ! promise ) {
			( { promise, resolve } = new Deferred )
			this[ key ] = { promise, resolve }
		}
		if ( late && lateValue ) {
			delete this[ key ].lateValue
			resolve( lateValue )
			console.log( 'late', key, lateValue )
		}
		return promise

	}

}



export class Time {

	constructor ( ) {
		this.origin = performance.now( )
		this.pauseStart = 0
	}

	get ( ) {
		return performance.now( ) - this.origin
	}

	pause ( ) {
		this.pauseStart = performance.now( )
	}

	resume ( ) {
		this.origin += performance.now( ) - this.pauseStart
	}

}


export function importWorker ( url ) {

	let w =	new Worker( url )

	return new Proxy( { }, {
		get ( tar, key ) {
			return async ( ...args ) => {
				w.postMessage( { fn: key, args },
					args.reduce( ( a, v ) => {
						if ( v instanceof ArrayBuffer ) a.push( v )
						else if ( ArrayBuffer.isView( v ) ) a.push( v.buffer )
						return a
					}, [ ] ) )
				return new Promise ( ( ok, ng ) => {
					w.onmessage = ok, w.onerror = ng
				} )
			}
		}
	} )

}
