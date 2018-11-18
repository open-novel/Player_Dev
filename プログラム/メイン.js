/*
These codes are licensed under CC0.
http://creativecommons.org/publicdomain/zero/1.0
*/

import * as $ from './ヘルパー.js'
// let Player
// if ( $.channel == 'Dev' )
// 	Player = import( '/Player_Dev/プログラム/システム.js' )
// else Player = import( './システム.js' )

import * as Player_Dev from '/Player_Dev/プログラム/システム.js'
import * as Player_Sbl from './システム.js'

const Player = $.channel == 'Dev' ? Player_Dev : Player_Sbl

window.addEventListener( 'DOMContentLoaded', main )

let installEvent = new $.Deferred

async function main( ) {

	//Canvas要素の配置と準備
	const wrapper = document.querySelector( '#ONPWrapper' )

	let option = JSON.parse( wrapper.dataset.onp || '{ }' )

	const player = document.createElement( 'div' )

	const canvas = document.createElement( 'canvas' )
	Object.assign( canvas, {
		width: 960,
		height: 540,
	} )

	wrapper.innerHTML = ''

	wrapper.appendChild( player )
	player.appendChild( canvas )

	if ( true || option.pwa ) {

		Object.assign( document.body.style, {
			backgroundColor: 'black',
			margin: '0',
			textAlign: 'center',
			width: '100vw',
			height: '100vh',
			overflow: 'hidden',
		} )
		Object.assign( player.style, {
			width: '100%',
			height: '100%',
			overflow: 'hidden',
		} )
		Object.assign( canvas.style, {
			display: 'inline-block',
			margin: 'auto',
			height: '56.25vw',
			width: '177.78vh',
			maxHeight: '100vh',
			maxWidth: '100vw',
		} )

	} else {

		Object.assign( player.style, {
			maxWidth: 'calc( 100% - 10px )',
			width: '960px',
			height: '540px',
			margin: '5px auto',
			padding: '5px',
			borderRadius: '10px 10px 0px 10px',
			boxShadow: '0px 0px 10px 1px blue inset',
			overflow: 'hidden',
			resize: 'horizontal',
		} )
		Object.assign( canvas.style, {
			width: '100%',
			height: '100%',
		} )

	}


	let ctx = canvas.getContext( '2d' )

	let captureEventTypes = [ 'down', 'up', 'move' ]

	for ( let type of captureEventTypes ) {
		canvas.addEventListener( `pointer${ type }`, e => {
			e.preventDefault( ), e.stopPropagation( )
			if ( e.button > 3 ) return
			let button = [ 'left' ,'middle', 'right' ] [ e.button ]
			Player.onPointerEvent( { type, button, x: e.offsetX, y: e.offsetY } )
		}, true )
	}

	canvas.addEventListener( 'contextmenu', e => e.preventDefault( ) )


	canvas.addEventListener( 'wheel', e => {
		e.preventDefault( )
		let type = e.deltaY >= 0 ? 'next' : 'back'
		Player.onKeyEvent( { type } )
	} )

	canvas.addEventListener( 'dragover', e => e.preventDefault( ) )
	canvas.addEventListener( 'drop', e => {
		e.preventDefault( )
		let files = e.dataTransfer.files
		if ( files && files[ 0 ] ) Player.onDrop( files[ 0 ] )
	} )

	window.addEventListener( 'keydown', e => {
		switch ( e.key ) {
			case 'Enter':
			case ' ':
				Player.onKeyEvent( { type: 'next' } )
		}
	} )

	window.addEventListener( 'message', e => {
		Player.onMessage( Object.assign( { port: e.ports[ 0 ] }, e.data ) )
	} )

	if ( window.opener ) {
		window.opener.postMessage( { type: 'ready' }, '*' )
	}


	Player.initPlayer( { ctx, mode: location.hash.slice( 1 ), installEvent, option } )


}

window.addEventListener( 'beforeinstallprompt', e => {
	installEvent.resolve( e )
	e.preventDefault( )
	return false
} )

let time = Date.now( )
if ( ! location.href.includes( '/Player' ) )
	navigator.serviceWorker.register( `/サービス.js?t=${ time }` )
//navigator.serviceWorker.register( `Player/サービス.js?t=${ time }`, { scope: '/Player/' } )
