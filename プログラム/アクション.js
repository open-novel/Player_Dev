/*
These codes are licensed under CC0.
http://creativecommons.org/publicdomain/zero/1.0
*/

import * as $ from './ヘルパー.js'
import * as Scenario from './シナリオ.js'
import * as Renderer from './レンダラー.js'
import * as Media from './メディア.js'
import * as DB from './データベース.js'

const FlipImg = $.importWorker( `APNG` )



let nowLayer, settings, trigger, others, stateList = [ ], messageLog = [ ]
let imageAnimes = [ ]



export async function init ( _settings = settings ) {

	settings = _settings
	//Object.values( cache ).forEach( map => { if ( map.clear ) map.clear( ) } )
	let oldLayer = nowLayer
	let layer = nowLayer = await Renderer.initRanderer( settings )
	if ( oldLayer ) oldLayer.fire( 'dispose' )
	trigger = new Trigger
	layer.on( 'menu' ).then( ( ) => showMenu( layer ) )
	layer.on( 'back' ).then( ( ) => showLog( layer ) )
	messageLog = [ ], imageAnimes = [ ]
	await Media.initMedia( settings )

}


export async function play ( settings, state, _others = others ) {

	others = _others
	let { origin = '', title } = settings
	others.title = title

	let startScenario = String( settings[ '開始シナリオ' ] || title )

	let text = await DB.getFile( `${ origin }${ title }/シナリオ/${ startScenario }` )

	let scenario = await Scenario.parse( text, startScenario )

	await init( settings )

	if ( ! state ) state = { scenario, origin, title }

	do {
		await Promise.race( [ Scenario.play( nowLayer, state, others ), nowLayer.on( 'dispose' ) ] )
		Array.from( document.querySelectorAll( 'img' ), elm => elm.remove( ) )
	} while ( state = stateList.shift( ) )

	await init( settings )

	sysMessage( '再生が終了しました' )
	let cho = await sysChoices( [
		'最初から再生する',
		//nagesenChk( '作者に投げ銭をする' ),
	], { backLabel: '作品選択へ' } )
	switch ( cho ) {
		case '最初から再生する': {
			return play( settings )
		} break
		case '作者に投げ銭をする': {
			await nagesen( )
		} break
	}

}




export let { target: initAction, register: nextInit } = new $.AwaitRegister( init )




const frame = new $.Awaiter
;( ( ) => {
	let oldTime = performance.now( )
	loop( )
	function loop ( newTime ) {
		let must = imageAnimes.length > 0 || newTime - oldTime >= 500
		Renderer.drawCanvas( must )
		animateImages( newTime )
		frame.fire( 'update' )
		oldTime = newTime
		requestAnimationFrame( loop )
	}
} ) ( )


//const action = new $.Awaiter
export function onAction ( type ) {

	//$.log( type )
	//action.fire( type, true )
	Renderer.onAction( type )

}


export async function onPoint ( { type, button, x, y } ) {

	if ( button == 'middle' ) return
	if ( button == 'right' ) {
		if ( type == 'up' ) //nowLayer.fire( 'menu' )
			Renderer.onAction( 'menu' )
		return
	}
	Renderer.onPoint( { type, x, y } )
}


export class Trigger {

	constructor ( ) { this.layer = nowLayer }

	step ( ) { return this.stepOr( ) }
	stepOr ( ...awaiters ) {
		if ( isOldLayer( this.layer ) ) return $.neverDone
		return Promise.race(
			[ this.layer.on( 'click' ), this.layer.on( 'next' ), ...awaiters ] )
	}
	stepOrFrameupdate ( ) { return this.stepOr( frame.on( 'update' ) ) }
	stepOrTimeout ( ms ) { return this.stepOr( $.timeout( ms ) ) }

}



export async function showSaveLoad ( { layer, title, isLoad = false, color } ) {
	let page = 1
	let visibleTileNo = 9, getTileNo = 27, totalPageNo = ( ( getTileNo / visibleTileNo ) | 0 ) + ( isLoad ? 1 : 0 )
	while ( page > 0 ) {

		let start = ( page - 1 ) * visibleTileNo
		let choices = await $.getSaveChoices( { title, start: ( isLoad && page == totalPageNo ) ? 1000 : start, num: visibleTileNo, isLoad } )

		let backLabel = page > 1 ? `ページ ${ page - 1 }` : '戻る'
		let currentLabel = `ページ ${ page }`
		let nextLabel = page < totalPageNo ? `ページ ${ page + 1 }` : ''

		if ( isLoad && page == totalPageNo ) currentLabel = 'オート'
		if ( isLoad && page == totalPageNo - 1 ) nextLabel = 'オート'

		let index = await sysChoices( choices, { backLabel, currentLabel, nextLabel, color, rowLen: 3 } )
		if ( index === $.Token.back ) page --
		else if ( index == $.Token.next ) page ++
		else if ( index == $.Token.close ) return $.Token.close
		else {
			if ( isLoad ) {
				return await DB.loadState( title, index )
			}
			else {
				return DB.saveState( title, index, Scenario.getState( layer )  )

			}
		}
	}
	return $.Token.back
}


export async function showMarkLoad ( { settings } ) {

	let markList = settings.marks

	if ( ( ! markList ) || ( ! markList.length ) ) return $.Token.back

	let page = 1
	let visibleTileNo = 10

	markList = markList.flatMap( ( { name, marks } ) => {
		let newList = [ ]

		let i = 0
		do {
			newList.push( { name, marks: marks.slice( i, i + visibleTileNo ) } )
			i += visibleTileNo
		} while ( i < marks.length )

		return newList
	} )

	$.log( markList )

	let  totalPageNo = markList.length
	while ( page > 0 ) {

		let EMPTY = { name: '' }
		let name = markList[ page - 1 ].name, backName = ( markList[ page - 2 ] || EMPTY ).name, nextName = ( markList[ page ] || EMPTY ) .name
		if ( backName.length < nextName.length ) backName = '　'.repeat( nextName.length - backName.length ) + backName
		if ( backName.length > nextName.length ) nextName = nextName + '　'.repeat( backName.length - nextName.length )

		let choices = markList[ page - 1 ].marks.map( label => ( { label: label == '$root' ? '（冒頭）' : label, value: label } ) )

		let backLabel = page > 1 ? backName : '戻る'
		let currentLabel = name
		let nextLabel = page < totalPageNo ? nextName : ''

		let mark = await sysChoices( choices, { backLabel, currentLabel, nextLabel, rowLen: 5 } )
		if ( mark === $.Token.back ) page --
		else if ( mark == $.Token.next ) page ++
		else if ( mark == $.Token.close ) return $.Token.close
		else return `${ name }#${ mark }`
	}

	return $.Token.back
}


async function showLog ( layer ) {

	let title = settings.title
	if ( ! title ) return

	let { logBox, logArea } = layer

	logArea.clear( )
	logBox.show( )


	let logLength =  messageLog.length

	let page = logLength - 1, pageHistory = [ page ]

	WHILE: while ( true ) {

		pageHistory.push( page )

		let log = [ ], height = 0

		while ( true ) {
			let decoLines = messageLog[ page ]
			height += decoLines.height
			log.unshift( decoLines )
			if ( page == 0 ) break
			if ( height + messageLog[ page - 1 ].height > 13 ) break
			page --
		}

		let offset = 0
		log = log.map( ( decoList, i ) => {
			let baseRow = decoList[ 0 ].row
			return decoList.map( deco => {
				if ( baseRow != deco.row ) {
					offset += deco.row - baseRow
					baseRow = deco.row
				}
				return ( { ...deco, row: i + offset } )
			} )
		} )

		$.log( log )

		logArea.put( log.flat( ) )


		let cho = await sysChoices( [ ], {
			color: 'green',
			currentLabel: '会話ログ',
			backLabel: pageHistory[ pageHistory.length - 1 ] == logLength - 1 ? '戻る' : '最新へ' ,
			nextLabel: page == 0 ? undefined : '過去へ',
		} )

		if ( cho == $.Token.back ) {
			if ( pageHistory[ pageHistory.length - 1 ] == logLength - 1 ) break WHILE
			page = pageHistory[ pageHistory.length - 2 ]
			pageHistory.pop( )
			pageHistory.pop( )
			continue WHILE
		}
		if ( cho == $.Token.next ) {
			continue WHILE
		}
		if ( cho == $.Token.close ) break WHILE


	}

	logBox.hide( )
	layer.on( 'back' ).then( ( ) => showLog( layer ) )


}


async function showMenu ( layer ) {

	let { title, origin } = settings
	if ( ! title ) return

	//layer.on( 'menu' ).then( ( ) => closeMenu( layer ) )

	WHILE: while ( true ) {


		let type = await sysChoices(
			[ 'セーブ', 'ロード', '会話ログ',
			'オート', 'スキップ', '会話非表示',
			'シェア',
			nagesenChk( '投げ銭' ),
			'終了する' ],
			{ backLabel: '戻る', color: 'green' }
		)

		let page = 1

		let visibleTileNo = 12, getTileNo = 24

		SWITCH: switch ( type ) {

			case $.Token.back:
			case $.Token.close:
				break WHILE

			break;
			case 'セーブ': {

				while ( true ) {
					let state = await showSaveLoad( { title, layer, color: 'green' } )
					if ( state == $.Token.back ) break SWITCH
					if ( state == $.Token.close ) break WHILE
				}

			} break
			case 'ロード': {

				let state = await showSaveLoad( { title, settings, isLoad: true, color: 'green' } )
				$.log( state )
				if ( state == $.Token.back ) break SWITCH
				if ( state == $.Token.close ) break WHILE
				stateList = [ state ]
				return init( )

			} break
			case '会話ログ': {

				showLog( layer )
				break WHILE

			} break
			case 'シェア': {

				let capture = false, hiquality = false
				WHILE2: while ( true ) {
					let choices = Object.entries( {
						[ ( capture ? '☑' : '☐' ) + '　　　同時にサムネイルをDLする　　　　' ]: 'capture',
						'Twitter': 'twitter.com/intent/tweet',
						'Mastodon (mstdn.jp)': 'mstdn.jp/share',
						//[ ( hiquality ? '🗹' : '☐' ) + 'サムネイルを高画質にする' ]: 'hiquality',
						'Friends (niconico)': 'friends.nico/share',
						'Pawoo (Pixiv)': 'pawoo.net/share',
					} ).map( ( [ key, value ] ) => ( { label: key, value } ) )
					let type = await sysChoices( choices, { rowLen: 5, backLabel: '戻る', color: 'green' } )
					if ( type == $.Token.back ) break SWITCH
					if ( type == $.Token.close ) break WHILE
					if ( type == 'capture' ) {
						capture = ! capture
						continue WHILE2
					}
					/*if ( type == 'hiquality' ) {
						hiquality = ! hiquality
						continue WHILE2
					}*/
					let url = `https://${ type }?text=`+ encodeURIComponent(
						`『${ title }』をプレイしています。\nby Openノベルプレイヤー https://open-novel.github.io` )
					window.open( url )
					//layer.conversationBox.prop( 'o', 0 )
					if ( capture ) {
						layer.menuBox.prop( 'o', 0 )
						layer.buttonGroup.prop( 'o', 0 )
						layer.iconGroup.prop( 'o', 0 )
						Renderer.drawCanvas( )
						$.download( await Renderer.toBlob( hiquality ), title )
						layer.menuBox.prop( 'o', 1 )
						layer.buttonGroup.prop( 'o', 1 )
					}
					break WHILE2
				}

			} break
			case 'オート': {

				( async ( ) => {

					let skipping = true
					layer.on( 'menu' ).then( ( ) => { skipping = false } )
					while ( skipping ) {
						layer.fire( 'next' )
						await $.timeout( 1000 )
					}

				} )( )

				break WHILE

			} break
			case 'スキップ': {

				( async ( ) => {

					let skipping = true
					layer.on( 'menu' ).then( ( ) => { skipping = false } )
					while ( skipping ) {
						layer.fire( 'next' )
						await $.timeout( 1 )
					}

				} )( )

				break WHILE

			} break
			case '投げ銭': {

				settings[ '投げ銭コメント' ]

				let cho = await nagesen( )
				if ( cho == $.Token.back ) break SWITCH
				if ( cho == $.Token.close ) break WHILE


			} break
			case '会話非表示': {

				let p = sysChoices( [ ], { } )
				nowLayer.conversationBox.hide( )
				nowLayer.iconGroup.hide( )
				await trigger.stepOr( p )
				nowLayer.conversationBox.show( )

			} break
			case '終了する': {

				let choices = [ '本当に終了する' ].map( label => ( { label } ) )
				let type = await sysChoices( choices, { backLabel: '戻る', color: 'green' } )
				if ( type == $.Token.back ) break SWITCH
				if ( type == $.Token.close ) break WHILE
				stateList.length = 0
				return init( )

			} break
			default: $.error( 'UnEx' )

		}
	}

	//layer.fire( 'menu' )

	layer.on( 'menu' ).then( ( ) => showMenu( layer ) )

}


export async function nagesen ( ) {

	let { title, origin } = settings
	let nofile, file = await $.getFile( `${ origin }${ title }/その他/投げ銭` ).catch( ( ) => null )
	if ( ! file ) nofile = await $.fetchFile( './画像/画像なし.svg' )
	let image = await $.getImage( file || nofile )

	let label = ( settings[ '投げ銭コメント' ] || [ '' ] ).join( '\n' )

	while ( true ) {

		let cho = await sysChoices( [
			{ label: '', bgimage: image },
			{ label, textLine: 8 }
		], {
			backLabel: '戻る',
			currentLabel: file ? '《投げ銭》' : '',
			rowLen: 1
		} )
		if ( $.isToken( cho )  ) return cho
		else $.download( image.src, '投げ銭用画像' )
	}

}

function nagesenChk ( label ) {
	return async function * ( ) {
		let { title, origin } = settings
		let disabled = true
		yield { label, disabled }
		disabled = ! (
			settings[ '投げ銭コメント' ] ||
			await $.getFile( `${ origin }${ title }/その他/投げ銭` ).catch( ( ) => null )
		)
		yield { label, value: label, disabled }
	}
}

export function isOldLayer ( layer ) {
	return layer != nowLayer
}


export function sysMessage ( text, speed = 100 ) {
	return showMessage ( nowLayer, '', text, speed )
}




export async function showMessage ( layer, name, text, speed ) {

	let nameArea = layer.nameArea.reborn( ), messageArea = layer.messageArea.reborn( )

	if ( name.length == 0 && text.length == 0 ) {
		layer.conversationBox.hide( )
		return
	}
	layer.conversationBox.show( )


	nameArea.clear( )
	for ( let deco of ( decoText( name )[ 0 ] || [ ] ).filter( deco => !! deco.text ) ) nameArea.add( deco )

	for ( let decoList of decoText( text ) ) {

		messageArea.clear( )
		//$.log( decoList )

		let len = decoList.length
		let index = 0

		let decoListPure = decoList.filter( deco => !! deco.text )

		decoListPure.height = decoList.height

		messageLog.push( decoListPure )

		let time = new $.Time

		let interrupt = false

		if ( speed == Infinity ) messageArea.put( decoListPure )

		else loop: while ( true ) {

			let to = ( interrupt || speed == Infinity ) ? len : ( speed * time.get( ) / 1000 | 0 )

			for ( ; index < to && index < len; index ++ ) {
				let deco = decoList[ index ], wait = deco.wait || 0, pace = deco.pace
				if ( pace ) {
					index ++
					speed = pace
					continue loop
				}
				if ( wait ) {
					index ++
					time.pause( )
					await trigger.stepOrTimeout( wait / speed * 1000 )
					time.resume( )
					continue loop
				}
				messageArea.add( deco )
			}

			if ( to >= len ) break

			interrupt = await trigger.stepOrFrameupdate( )
		}

		await trigger.step( )

	}

}


function decoText ( text ) {

	//$.log( 'texts', text )

	let decoList = [ ], decoLines = [ ], decoPages = [ ], overBuf = [ ]

	let mag = 1, bold = false, color = undefined
	let width = 0, height = 0, hMax = 1

	decoLines.push( decoList )
	for ( let unit of ( text.match( /\\\w(\[[\w.]+\])?|./gu ) || [ ] ) ) {
		let magic = unit.match( /\\(\w)\[?([\w.]+)?\]?/ )
		if ( magic ) {
			let [ , type, val ] = magic
			switch ( type ) {
							case 'w': decoList.push( { wait: val || Infinity } )
				break;	case 'p': decoList.push( { pace: val || Infinity } )
				break;	case 'n': { decoList = [ ], decoLines.push( decoList ) }
				break;	case 'b': bold = true
				break;	case 'B': bold = false
				break;	case 'c': color = val
				break;	case 'C': color = undefined
				break;	case 's': mag = val
				break;	case 'S': mag = 1
				break;	case '_':
				break;	default : $.warn( `"${ type }" このメタ文字は未実装です`　)
			}
		} else {
			let deco = { text: unit, mag, bold, color }
			deco.width = Renderer.DecoTextNode.measureWidth( deco )
			decoList.push( deco )
		}

	}

	//$.log( 'lines', [ ...decoLines ] )

	decoLines = decoLines.flatMap( decoList => {
		let lines = [ ]
		while ( decoList.length ) {

			let lineWidth = 0
			let line = [ ], lastMatch = null
			lines.push( line )

			X: while ( decoList.length ) {
				if ( lineWidth > 32 ) {
					let temp = [ ]

					if ( lastMatch ) while ( true ) {
						let deco = line.pop( )
						if ( deco == lastMatch ) break
						temp.unshift( deco )
					} else while ( lineWidth > 30 ) {
						let deco = line.pop( )
						temp.unshift( deco )
						lineWidth -= deco.width || 0
					}
					for ( let deco of temp.reverse( ) ) decoList.unshift( deco )
					break X
				}
				let deco = decoList.shift( )
				line.push( deco )
				lineWidth += deco.width || 0
				let chars = [ ... ',.!?)]、。！？）」』' ]
				if ( lineWidth > 20 && deco.text && chars.includes( deco.text ) ) {
					lastMatch = deco
				}
			}
		}

		return lines
	} )

	//$.log( 'lines', [ ...decoLines ] )

	while ( decoLines.length ) {
		let page = [ ], pageHeight = 0

		X: while ( decoLines.length ) {
			let line = decoLines.shift( )
			pageHeight += line.reduce( ( max, deco ) => Math.max( max, deco.mag || 0 ), 0 )
			if ( page.length > 0 && pageHeight > 3.3 ) {
				decoLines.unshift( line )
				break X
			} else page.push( line )
		}
		page = page.map( ( line, row ) => line.map( deco => ( { ...deco, row } ) ) ).flat( )
		page.height = pageHeight
		decoPages.push( page )
	}

	$.log( 'pages', [ ...decoPages ] )

	return decoPages

}


class ProgressTimer extends $.Awaiter {

	constructor ( ms = 0 ) {
		super( )
		this.enabled = !! ( ms >= 0 )
		this.started = false
		if ( ms > 0 ) this.start( ms )
	}

	async start ( ms ) {
		this.started = true
		if ( ! this.enabled ) return $.error( '完了したタイマーの再利用がありました' )
		let time = new $.Time
		while ( true ) {
			let interrupt = await trigger.stepOrFrameupdate( )
			let prog = interrupt ? 1 : time.get( ) / ms
			if ( prog > 1 ) prog = 1
			this.fire( 'step', prog )
			if ( prog == 1 ) break
		}
		this.started = false
		this.enabled = false
	}
}


let effects = {
	portraits: new ProgressTimer( -1 ),
	background: new ProgressTimer( -1 ),
}

export async function runEffect ( layer, type, sec ) {

	$.log( 'EF', type, sec )
	let ms = sec * 1000

	if ( type == 'フラッシュ' ) return

	if ( type == '準備' ) {
		for ( let [ key, eff ] of Object.entries( effects ) ) {
			$.log( eff )
			effects[ key ] = new ProgressTimer
		}
		return
	} else {
		await Promise.all( Object.values( effects ).map( eff => {
			eff.fire( 'type', type )
			return eff.start( ms )
		} ) )
	}

}


export function sysBGImage ( path ) {
	return showBGImage ( nowLayer, path, [ 0, 0, 1 ] )
}


export function showBGImage ( layer, path, [ x, y, h ] ) {
	let kind = 'background'
	let p = showImage( layer.backgroundGroup, path, { x, y, w: 1, h }, kind )
	if ( effects[ kind ].started ) return p
}


export function removeBGImages ( layer ) {
	let kind = 'background'
	let p = removeImages( layer.backgroundGroup, kind )
	if ( effects[ kind ].started ) return p
}


export function showPortrait ( layer, path, [ x, y, h ] ) {
	let kind = 'portraits'
	let p = showImage( layer.portraitGroup, path, { x, y, h }, kind )
	if ( effects[ kind ].started ) return p
}


export function removePortraits ( layer ) {
	let kind = 'portraits'
	let p = removeImages( layer.portraitGroup, kind )
	if ( effects[ kind ].started ) return p
}




function animateImages ( time ) {

	for ( let func of imageAnimes ) func( time )

}


async function setPNGAnime ( image, blob ) {

	let file = await FlipImg.splitPNG( await new Response( blob ).arrayBuffer( ) )

	let plays = file.plays
	if ( ! plays ) return

	//let baseTime = performance.now( )

	let canvas = document.createElement( 'canvas' )
	canvas.width = file.width
	canvas.height = file.height
	let ctx = canvas.getContext( '2d' )
	image.img = canvas

	file.forEach( chunk => {
		chunk.data = chunk.data.map( data => new Blob( [ data ], { type: 'image/png' } ) )

	} )

	//let reader = new FileReader
	//reader.onload = ( ) => $.log( reader.result )
	//reader.readAsDataURL( file[ 0 ].data[ 0 ] )

	$.log( file )


	let loop = 0, frame = 0, dispose = '', prev = null, preferred = performance.now( )
	async function animate ( ) {

		if ( ! image.parent ) return $.log( 'APNGアニメ中断' )
		loop ++
		if ( frame == 0 ) {
			if( loop > plays ) return $.log( 'APNGアニメ完了' )
			dispose = 'BACKGROUND'
		}

		let chunk = file[ frame ]

		let { width, height } = file

		let { blend, delay, x, y } = chunk


		let now = performance.now( )

		let lag = now - preferred

		setTimeout( animate, delay * 1000 - lag )

		preferred = now + delay * 1000


		let imgs = await Promise.all(
			chunk.data.map( blob => $.getImage( blob ) )
		)


		if ( dispose == 'BACKGROUND' )
			ctx.clearRect( 0, 0, width, height )
		if ( dispose == 'PREVIOUS' )
			ctx.putImageData( prev, 0, 0 )


		dispose = chunk.dispose

		if ( dispose == 'PREVIOUS' )
			prev = ctx.getImageData( 0, 0, file.width, file.height )


		for ( let img of imgs ) {
			if ( blend == 'SOURCE' ) {
				ctx.clearRect( 0, 0, width, height )
				blend = 'OVER'

			}

			//window.open( URL.createObjectURL( blob ) )
			ctx.drawImage( img, x, y )

		}


		if ( ++frame >= file.length ) frame = 0


	}
	animate( )

	imageAnimes.push( ( ) => { } )


}


async function setSVGAnime ( image, xml ) {
	let animates = Array.from( xml.querySelectorAll(
		'animate,  animateColor, animateMotion, animateTransform'
	), element => {
		let dur = element.getAttribute( 'dur' )
		if ( ! dur ) return null
		dur = dur.match( /^(\d+)(ms|s)$/i )
		if ( ! dur ) return null
		let duration = dur[ 2 ] == 's' ? dur[ 1 ] * 1000 : +dur[ 1 ]
		let values = ( element.getAttribute( 'values' ) || '' ).split( ';' )
		if ( values.length == 0 ) return null
		return { element, values, duration }
	} ).filter( obj => !! obj )

	let baseTime = performance.now( )

	let no = imageAnimes.push( time => {
		if ( ! image.parent ) return imageAnimes.splice( no - 1, 1 )
		let msec = time - baseTime
		for ( let { element, values, duration } of animates ) {
			let index = ( ( msec / duration ) % 1 ) * values.length | 0
			//$.log( duration, msec / duration, index, values )
			element.setAttribute( 'values', values[ index ] )
		}
		// TODO cache
		let text = new XMLSerializer( ).serializeToString( xml )
		let blob = new Blob( [ text ], { type: 'image/svg+xml' } )
		$.getImage( blob ).then( img => image.prop( 'img', img ) )

	} )
}



async function showImage ( targetGroup, path, pos, kind ) {

	let eff = effects[ kind ]
	if ( ! eff.enabled ) {
		eff = new ProgressTimer( 150 )
		effects[ kind ] = eff
		eff.fire( 'type', 'フェード' )
	}

	$.log( 'show???', eff.enabled )
	let type = await eff.on( 'type', true )

	let img, xml

	let blob = await $.getFile( path )
	let isPNG = blob.type.includes( 'png' )
	if ( blob.type.includes( 'svg+xml' ) ) {
		xml =  new DOMParser( ).parseFromString( await ( new Response( blob ).text( ) ) ,'image/svg+xml' )
	}

	img = await $.getImage( blob )

	if ( ! xml ) {
		//img.className = 'tempImg_' + targetGroup.name
		//document.body.append( img )
	}



	$.log( 'show', type, eff, targetGroup.name )


	let { h, w = 9 / 16 * h * img.naturalWidth / img.naturalHeight } = pos
	pos.w = w
	$.normalizePos( pos )
	let { x, y } = pos

	let image, oldPos

	switch ( type ) {
		case 'フェード': {
			image = new Renderer.ImageNode( { name: 'image', x, y, w, h, o: 0, img } )
			targetGroup.append( image )
		} break
		case 'トランス': {
			image = targetGroup.searchImg( img.src )
			oldPos = Object.assign( { }, image )
		} break
	}


	if ( isPNG && image ) setPNGAnime( image, blob )
	if ( xml && image ) setSVGAnime( image, xml )


	$.log( { x, y, w, h, pos, oldPos, image } )

	let before = -1
	while ( true ) {

		let prog = eff.started ? await eff.on( 'step', true ) : 1
		// $.log( 'show', 'step', prog )
		if ( prog == before ) {
			$.error( 'stepの変化が停止' )
			prog = 1
		}
		before = prog

		switch ( type ) {

			case 'フェード': {
				//image.prop( 'o', prog )
				image.prop( 'o', 1 - ( 1 - prog ) ** 3 )
			} break
			case 'トランス': {
				[ 'x', 'y', 'w', 'h' ].forEach( p => {
					let val = oldPos[ p ] * ( 1 - prog ) + pos[ p ] * prog
					//$.log( p, val )
					image.prop( p, val )
				} )

			} break

		}
		if ( prog == 1 ) break
	}


}


async function removeImages ( targetGroup, kind ) {

	let children = [ ... targetGroup.children ]

	let eff = effects[ kind ]
	if ( ! eff.enabled ) {
		eff = new ProgressTimer( 150 )
		effects[ kind ] = eff
		eff.fire( 'type', 'フェード' )
	}

	$.log( 'remv???', eff.enabled )
	let type = await eff.on( 'type', true )


	$.log( 'remv', type, eff, targetGroup.name )

	//Array.from( document.querySelectorAll( '.tempImg_' + targetGroup.name ), elm => elm.remove( ) )

	switch ( type ) {
		case 'フェード': {

			//for ( let image of children ) {
			//	image.fadeout = ! image.hasOtherChildren( )
			//}
			let before = -1
			while ( true ) {
				let prog = eff.started ? await eff.on( 'step', true ) : 1
				if ( prog == before ) {
					$.error( 'stepの変化が停止' )
					prog = 1
				}
				before = prog
				//for ( let image of children ) image.prop( 'o', 1 - prog )
				for ( let image of children ) image.prop( 'o', 1 - prog ** 3 )
				if ( prog == 1 ) break
			}
			for ( let image of children ) { image.remove( ) }
			//imageAnimes.length = 0
		} break
	}

}


export function hideIcons ( ) {
	nowLayer.iconGroup.prop( 'o', 0 )
}

export async function sysChoices ( choices, opt ) {
	return showChoices(  Object.assign( { layer: nowLayer, choices }, opt ) )
}

export async function scenarioChoices ( layer, choices ) {
	return showChoices( { layer, choices, inputBox: layer.inputBox, menuType: 'open', menuEnebled: false } )
}

export async function showChoices ( {
		layer, choices, inputBox = layer.menuBox, rowLen = 3,
		backLabel = '', currentLabel = '', nextLabel = '',
		menuType = 'close', menuEnebled = true, color = 'blue',
		altBack
	} ) {

	let m = .05

	let nextClicks = [ ]

	let len = choices.length
	let colLen = 1 + ( ( len - 1 ) / rowLen | 0 )
	let w = ( ( 1 - m / 2 ) - m / 2 * colLen ) / colLen
	let h = ( ( 1 - m ) - m * rowLen ) / rowLen

	for ( let i = 0; i < len; i++ ) {
		let cho = choices[ i ]
		let { label = '', value = label, disabled = false, bgimage = null, textLine = 1 } =
			( cho === Object( cho ) ) ? cho : { label: cho }
		//if ( ! label ) disabled = true
		let row = i % rowLen, col = i / rowLen | 0
		let [ x, y ] = [ m / 2 + ( w + m / 2 ) * col, m + ( h + m ) * row ]

		let choiceBox = new Renderer.RectangleNode( {
			name: 'choiceBox',
			x, y, w, h, listenerMode: textLine == 1 ? 'listen' : undefined,
			disabled,
			fill: bgimage ? 'rgba( 127, 127, 127, 1 )' : textLine != 1 ? 'rgba( 0, 0, 0, 0 )' : '',
			sound: ! disabled,
		} )
		inputBox.append( choiceBox )

		let image  = new Renderer.ImageNode( {
			name: 'bgimage', img: bgimage, o: .9, clip: true, fixed: true,
			listenerMode: 'listen', sound: ( ! disabled ) && textLine == 1,
		} )
		choiceBox.append( image )

		let textArea = new Renderer.TextNode( {
			name: 'choiceText',
			size: bgimage ? .35 : .7 / textLine,
			pos: textLine == 1 ? 'center' : undefined,
			y: bgimage ? .55 : textLine == 1 ? .05 : 0,

		} )
		choiceBox.append( textArea )

		let cliced = ( ) => {
			if ( ! choiceBox.disabled ) return value
			else return choiceBox.on( 'click' ).then( cliced )
		}

		nextClicks.push( choiceBox.on( 'click' ).then( cliced ) )
		textArea.set( label )

		//$.log( cho )
		if ( typeof cho == 'function' ) observe( )

		async function observe( ) {
			for await ( let obj of cho( ) ) {
				//$.log( 'obj', obj )
				( { label = '', value = label, disabled = false, bgimage = null } = obj )
				textArea.set( label )
				choiceBox.prop( 'disabled', disabled )
				choiceBox.prop( 'sound', ! disabled )
				image.prop( 'img', bgimage )
				image.prop( 'sound', ! disabled )
				textArea.prop( 'size', bgimage ? .35 : .7 )
				textArea.prop( 'y', bgimage ? .55 : .05 )
				//if ( Object( bgimage ) === bgimage ) image.show( )
				//alert( label )
			}
		}

	}

	let onMenu = ( ) => {
		if ( menuEnebled ) return $.Token.close
		layer.fire( 'menu' )
		return inputBox.on( 'menu' ).then( onMenu )
	}
	nextClicks.push( inputBox.on( 'menu' ).then( onMenu ) )

	let { backButton, nextButton } = layer

	inputBox.prop( 'color', color )
	inputBox.fill = len != 0 ? '' : 'rgba(0,0,0,0)'
	layer.buttonGroup.prop( 'color', color )

	layer.backLabel.clear( )
	layer.currentLabel.clear( )
	layer.nextLabel.clear( )

	if ( altBack ) altBack = 'red'

	if ( backLabel ) {
		backButton.prop( 'color', altBack )
		layer.backLabel.prop( 'color', altBack )
		layer.backLabel.set( backLabel )
		backButton.show( )
		nextClicks.push( backButton.on( 'click' ).then( ( ) => $.Token.back ) )
	}

	if ( currentLabel ) {
		layer.currentLabel.set( currentLabel )
	}

	if ( nextLabel ) {
		layer.nextLabel.set( nextLabel )
		nextButton.show( )
		nextClicks.push( nextButton.on( 'click' ).then( ( ) => $.Token.next ) )
	}


	if ( menuEnebled ) {
		layer.iconGroup.show( )
		layer.menuLabels.children.forEach( label => label.prop( 'o', 0 ) )
		layer.menuLabels[ menuType ].prop( 'o', 1 )
	}

	inputBox.show( )
	let val = await Promise.race( nextClicks ).finally( $.log )

	layer.backLabel.clear( )
	layer.currentLabel.clear( )
	layer.nextLabel.clear( )

	inputBox.removeChildren( )
	inputBox.hide( )
	backButton.hide( )
	nextButton.hide( )

	if ( menuEnebled ) {
		layer.menuLabels.children.forEach( label => label.prop( 'o', 0 ) )
		layer.menuLabels.open.prop( 'o', 1 )
	}

	return val

}

export async function sysPageChoices ( dataYielder, { maxPages, rowLen = 3, colLen = 3, menuType, altBack } ) {

	let cho, page = 1

	while ( true ) {

		let list = await Promise.all( [ ...Array( rowLen * colLen ).keys( ) ].map( async i => {
			let index = i + ( page - 1 ) * rowLen * colLen
			return ( ) => dataYielder( index )
		} ) )

		cho = await sysChoices( list, {
			rowLen, menuType,
			backLabel: ( page > 1 ? `ページ${ page - 1 }` : ( altBack ? altBack : '戻る' ) ),
			altBack: page > 1 ? undefined : altBack,
			currentLabel: `ページ${ page }`,
			nextLabel: ( page < maxPages ? `ページ${ page + 1 }` : '' ),
		} )

		if ( cho == $.Token.back ) page --
		else if ( cho == $.Token.next ) page ++
		else break
		if ( page <= 0 ) return $.Token.back
	}

	return cho
}


export async function presentVR ( flag ) {
	let VR = $.Settings.VR
	if ( flag ) {
		//let { run } = await import( './VR.js' )
		//let glCanvas = run( settings.ctx.canvas )
		//$.log( glCanvas )
		// return new Promise ( ok => {
		// 	document.body.onclick = () => {
		// 		ok ( VR.display.requestPresent( [ { source: glCanvas } ] ) )
		// 		document.body.onclick = null
		// 	}
		// } )
		return VR.display.requestPresent( [ { source: settings.ctx.canvas } ] )
	} else {
		return VR.display.exitPresent( )
	}
}


export function playBGV ( ...args ) {
	return trigger.stepOr( Media.playBGV( ...args ) )
}

export { playSE, playBGM, stopBGM, stopBGV, setMainVolume } from './メディア.js'
export { getFileList, getMarkList } from './シナリオ.js'
