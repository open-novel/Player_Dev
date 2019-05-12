/*
These codes are licensed under CC0.
http://creativecommons.org/publicdomain/zero/1.0
*/

'use strict'

// const $ = { log ( ...args ) { return console.log( ...args ) } }
const $ = { log ( ) { } }



self.addEventListener( 'message', async e => {

	let fn = { splitFile }[ e.data.fn ]
	if ( ! fn ) throw 'UnEx'

	let [ res, trans ] = await fn( ...e.data.args )

	self.postMessage( res, trans )

} )


/*
;( async function ( ) {

	let ab = await ( await fetch( 'apng.png' ) ).arrayBuffer( )
	let chunks = splitFile( ab )
	
	console.log( chunks )
	let reader = new FileReader
	reader.onload = ( ) => console.log( reader.result )
	reader.readAsDataURL( chunks[ 0 ].data[ 0 ] )


} )( );
*/


function splitFile( buf ) {


	return join( split( buf ) )


}



function join( chunks ) {


	let signature = new Uint8Array( [ 137, 80, 78, 71, 13, 10, 26, 10 ] )
	
	let no = 0

	return chunks.map( ch => {
		
		let { width, height } = ch

		ch.data = ch.data.map( data => {

			let IHDR = [
				Uint32BigAry( [ 13 ] ),
				new Uint8Array( [ 73, 72, 68, 82 ] ),
				Uint32BigAry( [ width, height ] ),
				chunks.etc,
				Uint32BigAry( [ 1995879252 ] ),
			]

			let IDAT = [
				Uint32BigAry( [ data.byteLength ] ),
				new Uint8Array( [73, 68, 65, 84] ),
				data,
				new Uint32Array( [ 0 ] ),  // TODO?
			]

			let IEND = [
				new Uint32Array( [ 0 ] ),
				new Uint8Array( [73, 69, 78, 68] ),
				Uint32BigAry( [ 2923585666 ] ),
			]

			let file = new File( [ signature, ...IHDR, ...IDAT, ...IEND ],
				`${ ++no }.png`, { type: 'image/png' } )

			//new Response( file ).arrayBuffer( ).then( ab => console.log( split( ab ) ) )

			return file

		} )
		return ch
	} )


	function Uint32BigAry ( ary ) {
		let view = new DataView( new ArrayBuffer( 4 * ary.length ) )
		for ( let i = 0; i < ary.length; i++ ) view.setUint32( 4 * i, ary[ i ] )
		return view.buffer
	}


}



function split( buf ) {


	let view = new DataView( buf )

	function equalBytes ( ary ) {

		for ( let i = 0; i < ary.length; i ++ ) {
			if ( view.getUint8( i ) !=  ary[ i ] ) return false
		}
		return true

	}

	function read8 ( ) {
		let num = view.getUint8( p )
		p += 1
		return num
	}
	function read16 ( ) {
		let num = view.getUint16( p )
		p += 2
		return num
	}
	function read32 ( ) {
		let num = view.getUint32( p )
		p += 4
		return num
	}
	function readT ( len ) {
		let dec = new TextDecoder
		return dec.decode( buf.slice( p, p += len ) )
	}




	let p = 0

	let isPNG = equalBytes( [ 137, 80, 78, 71, 13, 10, 26, 10 ] )

	if ( ! isPNG ) return null

	p = 8

	let chunks = [ ]
	while ( p < buf.byteLength ) {

		let length	= read32( )
		let type	= readT( 4 )
		let data	= readChunk( type, length )
		let crc		= read32( )


		if ( type == 'IHDR' || type == 'acTL' )
			Object.assign( chunks, data )
		if ( type == 'fcTL' )
			chunks[ chunks.length ] = data
		if ( type == 'IDAT' || type == 'fdAT' ) {
			if ( ! chunks[ chunks.length - 1 ] )
				chunks[ chunks.length ]　= { }
			if ( ! chunks[ chunks.length - 1 ].data )
				chunks[ chunks.length - 1 ].data = [ ]
			chunks[ chunks.length - 1 ].data.push( data.data )
			
		}

		console.log( type, crc )
		
	}


	return chunks


	



	function readChunk ( type, len ) {

		let fn = {

			IHDR () {
				let width	= read32( )
				let height	= read32( )
				let etc		= buf.slice( p, p += 5 )
				return { width, height, etc }
			},
			acTL () {
				let chunks	= read32( )
				let plays_n	= read32( )
				let plays	= plays_n || Infinity
				return { chunks, plays }
			},
			fcTL () {
				let sequence= read32( )
				let width	= read32( )
				let height	= read32( )
				let x		= read32( )
				let y		= read32( )
				let delay_n	= read16( ) 
				let delay_d	= read16( )
				let delay	= delay_n / ( delay_d || 100 )
				let dispose_op = read8( )
				let dispose = [ 'NONE', 'BACKGROUND', 'PREVIOUS' ][ dispose_op ]
				let blend_op  = read8( )
				let blend = [ 'SOURCE', 'OVER' ][ blend_op ]
				return { width, height, x, y, delay, dispose, blend }
			},
			IDAT () {
				let data = buf.slice( p, p += len )
				return { data }
			},
			fdAT () {
				let sequence = read32( )
				let data = buf.slice( p, p += len - 4 )
				return { data }
			},
			IEND () {
				return { }
			},
			tEXt () {
				return { text: readT( len ) }
			},


		}[ type ]

		if ( fn ) return fn( ) 
		else return { length: len, buffer: buf.slice( p, p += len ) }


	}




}
