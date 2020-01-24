/**
 * External dependencies
 */
import { render, unmountComponentAtNode } from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { first, last, nth } from 'lodash';
/**
 * WordPress dependencies
 */
import { useState, useRef } from '@wordpress/element';
import { UP, DOWN, ENTER } from '@wordpress/keycodes';
/**
 * Internal dependencies
 */
import LinkControl from '../';
import { fauxEntitySuggestions, fetchFauxEntitySuggestions } from './fixtures';

const mockFetchSearchSuggestions = jest.fn();

jest.mock( '@wordpress/data/src/components/use-select', () => () => ( {
	fetchSearchSuggestions: mockFetchSearchSuggestions,
} ) );

/**
 * Wait for next tick of event loop. This is required
 * because the `fetchSearchSuggestions` Promise will
 * resolve on the next tick of the event loop (this is
 * inline with the Promise spec). As a result we need to
 * wait on this loop to "tick" before we can expect the UI
 * to have updated.
 */
function eventLoopTick() {
	return new Promise( ( resolve ) => setImmediate( resolve ) );
}

let container = null;

beforeEach( () => {
	// setup a DOM element as a render target
	container = document.createElement( 'div' );
	document.body.appendChild( container );
	mockFetchSearchSuggestions.mockImplementation( fetchFauxEntitySuggestions );
} );

afterEach( () => {
	// cleanup on exiting
	unmountComponentAtNode( container );
	container.remove();
	container = null;
	mockFetchSearchSuggestions.mockReset();
} );

function getURLInput() {
	return container.querySelector( 'input[aria-label="URL"]' );
}

function getSearchResults() {
	const input = getURLInput();
	// The input has `aria-owns` to indicate that it owns (and is related to)
	// the search results with `role="listbox"`.
	const relatedSelector = input.getAttribute( 'aria-owns' );

	// Select by relationship as well as role
	return container.querySelectorAll(
		`#${ relatedSelector }[role="listbox"] [role="option"]`
	);
}

function getCurrentLink() {
	return container.querySelector(
		'.block-editor-link-control__search-item.is-current'
	);
}

describe( 'Basic rendering', () => {
	it( 'should render', () => {
		act( () => {
			render( <LinkControl />, container );
		} );

		// Search Input UI
		const searchInput = getURLInput();

		expect( searchInput ).not.toBeNull();
		expect( container.innerHTML ).toMatchSnapshot();
	} );

	describe( 'forceIsEditingLink', () => {
		const isEditing = () => !! getURLInput();

		it( 'undefined', () => {
			act( () => {
				render(
					<LinkControl value={ { url: 'https://example.com' } } />,
					container
				);
			} );

			expect( isEditing() ).toBe( false );
		} );

		it( 'true', () => {
			act( () => {
				render(
					<LinkControl
						value={ { url: 'https://example.com' } }
						forceIsEditingLink
					/>,
					container
				);
			} );

			expect( isEditing() ).toBe( true );
		} );

		it( 'false', () => {
			act( () => {
				render(
					<LinkControl value={ { url: 'https://example.com' } } />,
					container
				);
			} );

			// Click the "Edit" button to trigger into the editing mode.
			const editButton = Array.from(
				container.querySelectorAll( 'button' )
			).find( ( button ) => button.innerHTML.includes( 'Edit' ) );

			act( () => {
				Simulate.click( editButton );
			} );

			expect( isEditing() ).toBe( true );

			// If passed `forceIsEditingLink` of `false` while editing, should
			// forcefully reset to the preview state.
			act( () => {
				render(
					<LinkControl
						value={ { url: 'https://example.com' } }
						forceIsEditingLink={ false }
					/>,
					container
				);
			} );

			expect( isEditing() ).toBe( false );
		} );
	} );
} );

describe( 'Searching for a link', () => {
	it( 'should display loading UI when input is valid but search results have yet to be returned', async () => {
		const searchTerm = 'Hello';

		let resolver;

		const fauxRequest = () =>
			new Promise( ( resolve ) => {
				resolver = resolve;
			} );

		mockFetchSearchSuggestions.mockImplementation( fauxRequest );

		act( () => {
			render( <LinkControl />, container );
		} );

		// Search Input UI
		const searchInput = getURLInput();

		// Simulate searching for a term
		act( () => {
			Simulate.change( searchInput, { target: { value: searchTerm } } );
		} );

		// fetchFauxEntitySuggestions resolves on next "tick" of event loop
		await eventLoopTick();

		const searchResultElements = getSearchResults();

		let loadingUI = container.querySelector( '.components-spinner' );

		expect( searchResultElements ).toHaveLength( 0 );

		expect( loadingUI ).not.toBeNull();

		act( () => {
			resolver( fauxEntitySuggestions );
		} );

		await eventLoopTick();

		loadingUI = container.querySelector( '.components-spinner' );

		expect( loadingUI ).toBeNull();
	} );

	it( 'should display only search suggestions when current input value is not URL-like', async () => {
		const searchTerm = 'Hello world';
		const firstFauxSuggestion = first( fauxEntitySuggestions );

		act( () => {
			render( <LinkControl />, container );
		} );

		// Search Input UI
		const searchInput = getURLInput();

		// Simulate searching for a term
		act( () => {
			Simulate.change( searchInput, { target: { value: searchTerm } } );
		} );

		// fetchFauxEntitySuggestions resolves on next "tick" of event loop
		await eventLoopTick();

		const searchResultElements = getSearchResults();

		const firstSearchResultItemHTML = first( searchResultElements )
			.innerHTML;
		const lastSearchResultItemHTML = last( searchResultElements ).innerHTML;

		expect( searchResultElements ).toHaveLength(
			fauxEntitySuggestions.length
		);

		// Sanity check that a search suggestion shows up corresponding to the data
		expect( firstSearchResultItemHTML ).toEqual(
			expect.stringContaining( firstFauxSuggestion.title )
		);
		expect( firstSearchResultItemHTML ).toEqual(
			expect.stringContaining( firstFauxSuggestion.type )
		);

		// The fallback URL suggestion should not be shown when input is not URL-like
		expect( lastSearchResultItemHTML ).not.toEqual(
			expect.stringContaining( 'URL' )
		);
	} );

	it.each( [
		[ 'couldbeurlorentitysearchterm' ],
		[ 'ThisCouldAlsoBeAValidURL' ],
	] )(
		'should display a URL suggestion as a default fallback for the search term "%s" which could potentially be a valid url.',
		async ( searchTerm ) => {
			act( () => {
				render( <LinkControl />, container );
			} );

			// Search Input UI
			const searchInput = getURLInput();

			// Simulate searching for a term
			act( () => {
				Simulate.change( searchInput, {
					target: { value: searchTerm },
				} );
			} );

			// fetchFauxEntitySuggestions resolves on next "tick" of event loop
			await eventLoopTick();

			const searchResultElements = getSearchResults();

			const lastSearchResultItemHTML = last( searchResultElements )
				.innerHTML;
			const additionalDefaultFallbackURLSuggestionLength = 1;

			// We should see a search result for each of the expect search suggestions
			// plus 1 additional one for the fallback URL suggestion
			expect( searchResultElements ).toHaveLength(
				fauxEntitySuggestions.length +
					additionalDefaultFallbackURLSuggestionLength
			);

			// The last item should be a URL search suggestion
			expect( lastSearchResultItemHTML ).toEqual(
				expect.stringContaining( searchTerm )
			);
			expect( lastSearchResultItemHTML ).toEqual(
				expect.stringContaining( 'URL' )
			);
			expect( lastSearchResultItemHTML ).toEqual(
				expect.stringContaining( 'Press ENTER to add this link' )
			);
		}
	);
} );

describe( 'Manual link entry', () => {
	it.each( [
		[ 'https://make.wordpress.org' ], // explicit https
		[ 'http://make.wordpress.org' ], // explicit http
		[ 'www.wordpress.org' ], // usage of "www"
	] )(
		'should display a single suggestion result when the current input value is URL-like (eg: %s)',
		async ( searchTerm ) => {
			act( () => {
				render( <LinkControl />, container );
			} );

			// Search Input UI
			const searchInput = getURLInput();

			// Simulate searching for a term
			act( () => {
				Simulate.change( searchInput, {
					target: { value: searchTerm },
				} );
			} );

			// fetchFauxEntitySuggestions resolves on next "tick" of event loop
			await eventLoopTick();

			const searchResultElements = getSearchResults();

			const firstSearchResultItemHTML =
				searchResultElements[ 0 ].innerHTML;
			const expectedResultsLength = 1;

			expect( searchResultElements ).toHaveLength(
				expectedResultsLength
			);
			expect( firstSearchResultItemHTML ).toEqual(
				expect.stringContaining( searchTerm )
			);
			expect( firstSearchResultItemHTML ).toEqual(
				expect.stringContaining( 'URL' )
			);
			expect( firstSearchResultItemHTML ).toEqual(
				expect.stringContaining( 'Press ENTER to add this link' )
			);
		}
	);

	describe( 'Alternative link protocols and formats', () => {
		it.each( [
			[ 'mailto:example123456@wordpress.org', 'mailto' ],
			[ 'tel:example123456@wordpress.org', 'tel' ],
			[ '#internal-anchor', 'internal' ],
		] )(
			'should recognise "%s" as a %s link and handle as manual entry by displaying a single suggestion',
			async ( searchTerm, searchType ) => {
				act( () => {
					render( <LinkControl />, container );
				} );

				// Search Input UI
				const searchInput = getURLInput();

				// Simulate searching for a term
				act( () => {
					Simulate.change( searchInput, {
						target: { value: searchTerm },
					} );
				} );

				// fetchFauxEntitySuggestions resolves on next "tick" of event loop
				await eventLoopTick();

				const searchResultElements = getSearchResults();

				const firstSearchResultItemHTML =
					searchResultElements[ 0 ].innerHTML;
				const expectedResultsLength = 1;

				expect( searchResultElements ).toHaveLength(
					expectedResultsLength
				);
				expect( firstSearchResultItemHTML ).toEqual(
					expect.stringContaining( searchTerm )
				);
				expect( firstSearchResultItemHTML ).toEqual(
					expect.stringContaining( searchType )
				);
				expect( firstSearchResultItemHTML ).toEqual(
					expect.stringContaining( 'Press ENTER to add this link' )
				);
			}
		);
	} );
} );

describe( 'Default search suggestions', () => {
	it( 'should display a list of initial search suggestions when there is no search value or suggestions', async () => {
		const expectedResultsLength = 3; // set within `LinkControl`

		act( () => {
			render( <LinkControl showInitialSuggestions />, container );
		} );

		await eventLoopTick();

		// Search Input UI
		const searchInput = getURLInput();

		const searchResultsWrapper = container.querySelector(
			'[role="listbox"]'
		);
		const initialSearchResultElements = searchResultsWrapper.querySelectorAll(
			'[role="option"]'
		);

		const searchResultsLabel = container.querySelector(
			`#${ searchResultsWrapper.getAttribute( 'aria-labelledby' ) }`
		);

		// Verify input has no value has default suggestions should only show
		// when this does not have a value
		expect( searchInput.value ).toBe( '' );

		// Ensure only called once as a guard against potential infinite
		// re-render loop within `componentDidUpdate` calling `updateSuggestions`
		// which has calls to `setState` within it.
		expect( mockFetchSearchSuggestions ).toHaveBeenCalledTimes( 1 );

		// Verify the search results already display the initial suggestions
		expect( initialSearchResultElements ).toHaveLength(
			expectedResultsLength
		);

		expect( searchResultsLabel.innerHTML ).toEqual( 'Recently updated' );
	} );

	it( 'should not display initial suggestions when input value is present', async () => {
		// Render with an initial value an ensure that no initial suggestions
		// are shown.
		//
		act( () => {
			render(
				<LinkControl
					showInitialSuggestions
					value={ fauxEntitySuggestions[ 0 ] }
				/>,
				container
			);
		} );

		await eventLoopTick();

		expect( mockFetchSearchSuggestions ).not.toHaveBeenCalled();

		//
		// Click the "Edit/Change" button and check initial suggestions are not
		// shown.
		//
		const currentLinkUI = getCurrentLink();
		const currentLinkBtn = currentLinkUI.querySelector( 'button' );

		act( () => {
			Simulate.click( currentLinkBtn );
		} );

		await eventLoopTick();

		const searchResultElements = getSearchResults();

		const searchInput = getURLInput();

		// search input is set to the URL value
		expect( searchInput.value ).toEqual( fauxEntitySuggestions[ 0 ].url );

		// it should match any url that's like ?p= and also include a URL option
		expect( searchResultElements ).toHaveLength( 5 );

		expect( mockFetchSearchSuggestions ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'should display initial suggestions when input value is manually deleted', async () => {
		const searchTerm = 'Hello world';

		act( () => {
			render( <LinkControl showInitialSuggestions />, container );
		} );

		let searchResultElements;
		let searchInput;

		// Search Input UI
		searchInput = getURLInput();

		// Simulate searching for a term
		act( () => {
			Simulate.change( searchInput, { target: { value: searchTerm } } );
		} );

		// fetchFauxEntitySuggestions resolves on next "tick" of event loop
		await eventLoopTick();

		expect( searchInput.value ).toBe( searchTerm );

		searchResultElements = getSearchResults();

		// delete the text
		act( () => {
			Simulate.change( searchInput, { target: { value: '' } } );
		} );

		await eventLoopTick();

		searchResultElements = getSearchResults();

		searchInput = getURLInput();

		// check the input is empty now
		expect( searchInput.value ).toBe( '' );

		const searchResultLabel = container.querySelector(
			'.block-editor-link-control__search-results-label'
		);

		expect( searchResultLabel.innerHTML ).toBe( 'Recently updated' );

		expect( searchResultElements ).toHaveLength( 3 );
	} );
} );

describe( 'Creating Entities (eg: Posts, Pages)', () => {
	it.each( [
		[ 'HelloWorld', 'without spaces' ],
		[ 'Hello World', 'with spaces' ],
	] )( 'should display option to create a link for a valid Entity title "%s" (%s)', async ( entityNameText ) => {
		const noResults = [];

		// Force returning empty results for existing Pages. Doing this means that the only item
		// shown should be "Create Page" suggestion because there will be no search suggestions
		// and our input does not conform to a direct entry schema (eg: a URL).
		mockFetchSearchSuggestions.mockImplementation( () => Promise.resolve( noResults ) );

		const LinkControlConsumer = () => {
			const [ link, setLink ] = useState( null );

			return ( <LinkControl
				value={ link }
				showCreateEntity={ true }
				onChange={ ( suggestion ) => {
					setLink( suggestion );
				} }
				createEntity={ ( type, title ) => Promise.resolve( {
					type,
					title,
					id: 123,
					url: '/?p=123',
				} ) }
			/> );
		};

		act( () => {
			render( <LinkControlConsumer />, container );
		} );

		// Search Input UI
		const searchInput = container.querySelector( 'input[aria-label="URL"]' );

		// Simulate searching for a term
		act( () => {
			Simulate.change( searchInput, { target: { value: entityNameText } } );
		} );

		await eventLoopTick();

		// TODO: select these by aria relationship to autocomplete rather than arbitary selector.
		const searchResultElements = container.querySelectorAll( '[role="listbox"] [role="option"]' );

		const createButton = first( Array.from( searchResultElements ).filter( ( result ) => result.innerHTML.includes( 'Create new' ) ) );

		expect( createButton ).not.toBeNull();
		expect( createButton.innerHTML ).toEqual( expect.stringContaining( entityNameText ) );

		await act( async () => {
			Simulate.click( createButton );
		} );

		await eventLoopTick();

		const currentLinkLabel = container.querySelector( '[aria-label="Currently selected"]' );

		const currentLink = container.querySelector( `[aria-labelledby="${ currentLinkLabel.id }"]` );

		const currentLinkHTML = currentLink.innerHTML;

		expect( currentLinkHTML ).toEqual( expect.stringContaining( entityNameText ) ); //title
		expect( currentLinkHTML ).toEqual( expect.stringContaining( '/?p=123' ) ); // slug
	} );

	it( 'should show not show an option to create "blank" entity in initial suggestions (when input is empty)', async () => {
		act( () => {
			render(
				<LinkControl
					showInitialSuggestions={ true } // should show even if we're not showing initial suggestions
					showCreateEntity={ true }
					createEntity={ jest.fn() }
				/>, container
			);
		} );
		// Await the initial suggestions to be fetched
		await eventLoopTick();

		// Search Input UI
		const searchInput = container.querySelector( 'input[aria-label="URL"]' );

		// TODO: select these by aria relationship to autocomplete rather than arbitary selector.
		const searchResultElements = container.querySelectorAll( '[role="listbox"] [role="option"]' );
		const createButton = first( Array.from( searchResultElements ).filter( ( result ) => result.innerHTML.includes( 'Create new' ) ) );

		// Verify input has no value
		expect( searchInput.value ).toBe( '' );
		expect( createButton ).toBeFalsy(); // shouldn't exist!
	} );

	it.each( [
		'https://wordpress.org',
		'www.wordpress.org',
		'mailto:example123456@wordpress.org',
		'tel:example123456@wordpress.org',
		'#internal-anchor',
	] )( 'should not show option to "Create Page" when text is a form of direct entry (eg: %s)', async ( inputText ) => {
		act( () => {
			render(
				<LinkControl
					showCreateEntity={ true }
					createEntity={ jest.fn() }
				/>, container
			);
		} );

		// Search Input UI
		const searchInput = container.querySelector( 'input[aria-label="URL"]' );

		// Simulate searching for a term
		act( () => {
			Simulate.change( searchInput, { target: { value: inputText } } );
		} );

		await eventLoopTick();

		// TODO: select these by aria relationship to autocomplete rather than arbitary selector.
		const searchResultElements = container.querySelectorAll( '[role="listbox"] [role="option"]' );

		const createButton = Array.from( searchResultElements ).filter( ( result ) => result.innerHTML.includes( 'Create new' ) );

		expect( createButton ).toBeNull();
	} );
} );

describe( 'Selecting links', () => {
	it( 'should display a selected link corresponding to the provided "currentLink" prop', () => {
		const selectedLink = first( fauxEntitySuggestions );

		const LinkControlConsumer = () => {
			const [ link ] = useState( selectedLink );

			return <LinkControl value={ link } />;
		};

		act( () => {
			render( <LinkControlConsumer />, container );
		} );

		// TODO: select by aria role or visible text
		const currentLink = getCurrentLink();
		const currentLinkHTML = currentLink.innerHTML;
		const currentLinkAnchor = currentLink.querySelector(
			`[href="${ selectedLink.url }"]`
		);

		expect( currentLinkHTML ).toEqual(
			expect.stringContaining( selectedLink.title )
		);
		expect( currentLinkHTML ).toEqual(
			expect.stringContaining( selectedLink.type )
		);
		expect( currentLinkHTML ).toEqual( expect.stringContaining( 'Edit' ) );
		expect( currentLinkAnchor ).not.toBeNull();
	} );

	it( 'should hide "selected" link UI and display search UI prepopulated with previously selected link title when "Change" button is clicked', () => {
		const selectedLink = first( fauxEntitySuggestions );

		const LinkControlConsumer = () => {
			const [ link, setLink ] = useState( selectedLink );

			return (
				<LinkControl
					value={ link }
					onChange={ ( suggestion ) => setLink( suggestion ) }
				/>
			);
		};

		act( () => {
			render( <LinkControlConsumer />, container );
		} );

		// Required in order to select the button below
		let currentLinkUI = getCurrentLink();
		const currentLinkBtn = currentLinkUI.querySelector( 'button' );

		// Simulate searching for a term
		act( () => {
			Simulate.click( currentLinkBtn );
		} );

		const searchInput = getURLInput();
		currentLinkUI = getCurrentLink();

		// We should be back to showing the search input
		expect( searchInput ).not.toBeNull();
		expect( searchInput.value ).toBe( selectedLink.url ); // prepopulated with previous link's URL
		expect( currentLinkUI ).toBeNull();
	} );

	describe( 'Selection using mouse click', () => {
		it.each( [
			[ 'entity', 'hello world', first( fauxEntitySuggestions ) ], // entity search
			[
				'url',
				'https://www.wordpress.org',
				{
					id: '1',
					title: 'https://www.wordpress.org',
					url: 'https://www.wordpress.org',
					type: 'URL',
				},
			], // url
		] )(
			'should display a current selected link UI when a %s suggestion for the search "%s" is clicked',
			async ( type, searchTerm, selectedLink ) => {
				const LinkControlConsumer = () => {
					const [ link, setLink ] = useState();

					return (
						<LinkControl
							value={ link }
							onChange={ ( suggestion ) => setLink( suggestion ) }
						/>
					);
				};

				act( () => {
					render( <LinkControlConsumer />, container );
				} );

				// Search Input UI
				const searchInput = getURLInput();

				// Simulate searching for a term
				act( () => {
					Simulate.change( searchInput, {
						target: { value: searchTerm },
					} );
				} );

				// fetchFauxEntitySuggestions resolves on next "tick" of event loop
				await eventLoopTick();

				const searchResultElements = getSearchResults();

				const firstSearchSuggestion = first( searchResultElements );

				// Simulate selecting the first of the search suggestions
				act( () => {
					Simulate.click( firstSearchSuggestion );
				} );

				const currentLink = container.querySelector(
					'.block-editor-link-control__search-item.is-current'
				);
				const currentLinkHTML = currentLink.innerHTML;
				const currentLinkAnchor = currentLink.querySelector(
					`[href="${ selectedLink.url }"]`
				);

				// Check that this suggestion is now shown as selected
				expect( currentLinkHTML ).toEqual(
					expect.stringContaining( selectedLink.title )
				);
				expect( currentLinkHTML ).toEqual(
					expect.stringContaining( 'Edit' )
				);
				expect( currentLinkAnchor ).not.toBeNull();
			}
		);
	} );

	describe( 'Selection using keyboard', () => {
		it.each( [
			[ 'entity', 'hello world', first( fauxEntitySuggestions ) ], // entity search
			[
				'url',
				'https://www.wordpress.org',
				{
					id: '1',
					title: 'https://www.wordpress.org',
					url: 'https://www.wordpress.org',
					type: 'URL',
				},
			], // url
		] )(
			'should display a current selected link UI when an %s suggestion for the search "%s" is selected using the keyboard',
			async ( type, searchTerm, selectedLink ) => {
				const LinkControlConsumer = () => {
					const [ link, setLink ] = useState();

					return (
						<LinkControl
							value={ link }
							onChange={ ( suggestion ) => setLink( suggestion ) }
						/>
					);
				};

				act( () => {
					render( <LinkControlConsumer />, container );
				} );

				// Search Input UI
				const searchInput = getURLInput();
				const form = container.querySelector( 'form' );

				// Simulate searching for a term
				act( () => {
					Simulate.change( searchInput, {
						target: { value: searchTerm },
					} );
				} );

				//fetchFauxEntitySuggestions resolves on next "tick" of event loop
				await eventLoopTick();

				// Step down into the search results, highlighting the first result item
				act( () => {
					Simulate.keyDown( searchInput, { keyCode: DOWN } );
				} );

				const searchResultElements = getSearchResults();

				const firstSearchSuggestion = first( searchResultElements );
				const secondSearchSuggestion = nth( searchResultElements, 1 );

				let selectedSearchResultElement = container.querySelector(
					'[role="option"][aria-selected="true"]'
				);

				// We should have highlighted the first item using the keyboard
				expect( selectedSearchResultElement ).toEqual(
					firstSearchSuggestion
				);

				// Only entity searches contain more than 1 suggestion
				if ( type === 'entity' ) {
					// Check we can go down again using the down arrow
					act( () => {
						Simulate.keyDown( searchInput, { keyCode: DOWN } );
					} );

					selectedSearchResultElement = container.querySelector(
						'[role="option"][aria-selected="true"]'
					);

					// We should have highlighted the first item using the keyboard
					expect( selectedSearchResultElement ).toEqual(
						secondSearchSuggestion
					);

					// Check we can go back up via up arrow
					act( () => {
						Simulate.keyDown( searchInput, { keyCode: UP } );
					} );

					selectedSearchResultElement = container.querySelector(
						'[role="option"][aria-selected="true"]'
					);

					// We should be back to highlighting the first search result again
					expect( selectedSearchResultElement ).toEqual(
						firstSearchSuggestion
					);
				}

				// Commit the selected item as the current link
				act( () => {
					Simulate.keyDown( searchInput, { keyCode: ENTER } );
				} );
				act( () => {
					Simulate.submit( form );
				} );

				// Check that the suggestion selected via is now shown as selected
				const currentLink = container.querySelector(
					'.block-editor-link-control__search-item.is-current'
				);
				const currentLinkHTML = currentLink.innerHTML;
				const currentLinkAnchor = currentLink.querySelector(
					`[href="${ selectedLink.url }"]`
				);

				// Make sure focus is retained after submission.
				expect( container.contains( document.activeElement ) ).toBe(
					true
				);

				expect( currentLinkHTML ).toEqual(
					expect.stringContaining( selectedLink.title )
				);
				expect( currentLinkHTML ).toEqual(
					expect.stringContaining( 'Edit' )
				);
				expect( currentLinkAnchor ).not.toBeNull();
			}
		);

		it( 'should allow selection of initial search results via the keyboard', async () => {
			act( () => {
				render( <LinkControl showInitialSuggestions />, container );
			} );

			await eventLoopTick();

			const searchResultsWrapper = container.querySelector(
				'[role="listbox"]'
			);

			const searchResultsLabel = container.querySelector(
				`#${ searchResultsWrapper.getAttribute( 'aria-labelledby' ) }`
			);

			expect( searchResultsLabel.innerHTML ).toEqual(
				'Recently updated'
			);

			// Search Input UI
			const searchInput = getURLInput();

			// Step down into the search results, highlighting the first result item
			act( () => {
				Simulate.keyDown( searchInput, { keyCode: DOWN } );
			} );

			await eventLoopTick();

			const searchResultElements = getSearchResults();

			const firstSearchSuggestion = first( searchResultElements );
			const secondSearchSuggestion = nth( searchResultElements, 1 );

			let selectedSearchResultElement = container.querySelector(
				'[role="option"][aria-selected="true"]'
			);

			// We should have highlighted the first item using the keyboard
			expect( selectedSearchResultElement ).toEqual(
				firstSearchSuggestion
			);

			// Check we can go down again using the down arrow
			act( () => {
				Simulate.keyDown( searchInput, { keyCode: DOWN } );
			} );

			selectedSearchResultElement = container.querySelector(
				'[role="option"][aria-selected="true"]'
			);

			// We should have highlighted the first item using the keyboard
			expect( selectedSearchResultElement ).toEqual(
				secondSearchSuggestion
			);

			// Check we can go back up via up arrow
			act( () => {
				Simulate.keyDown( searchInput, { keyCode: UP } );
			} );

			selectedSearchResultElement = container.querySelector(
				'[role="option"][aria-selected="true"]'
			);

			// We should be back to highlighting the first search result again
			expect( selectedSearchResultElement ).toEqual(
				firstSearchSuggestion
			);

			expect( mockFetchSearchSuggestions ).toHaveBeenCalledTimes( 1 );
		} );
	} );

	it( 'does not forcefully regain focus if onChange handler had shifted it', () => {
		// Regression: Previously, there had been issues where if `onChange`
		// would programmatically shift focus, LinkControl would try to force it
		// back, based on its internal logic to determine whether it had focus
		// when finishing an edit occuring _before_ `onChange` having been run.
		//
		// See: https://github.com/WordPress/gutenberg/pull/19462

		const LinkControlConsumer = () => {
			const focusTarget = useRef();

			return (
				<>
					<div tabIndex={ -1 } data-expected ref={ focusTarget } />
					<LinkControl
						onChange={ () => focusTarget.current.focus() }
					/>
				</>
			);
		};

		act( () => {
			render( <LinkControlConsumer />, container );
		} );

		// Change value.
		const form = container.querySelector( 'form' );
		const searchInput = getURLInput();

		// Simulate searching for a term
		act( () => {
			Simulate.change( searchInput, {
				target: { value: 'https://example.com' },
			} );
		} );
		act( () => {
			Simulate.keyDown( searchInput, { keyCode: ENTER } );
		} );
		act( () => {
			Simulate.submit( form );
		} );

		const isExpectedFocusTarget = document.activeElement.hasAttribute(
			'data-expected'
		);
		expect( isExpectedFocusTarget ).toBe( true );
	} );
} );

describe( 'Addition Settings UI', () => {
	it( 'should display "New Tab" setting (in "off" mode) by default when a link is selected', async () => {
		const selectedLink = first( fauxEntitySuggestions );
		const expectedSettingText = 'Open in New Tab';

		const LinkControlConsumer = () => {
			const [ link ] = useState( selectedLink );

			return <LinkControl value={ link } />;
		};

		act( () => {
			render( <LinkControlConsumer />, container );
		} );

		const newTabSettingLabel = Array.from(
			container.querySelectorAll( 'label' )
		).find(
			( label ) =>
				label.innerHTML &&
				label.innerHTML.includes( expectedSettingText )
		);
		expect( newTabSettingLabel ).not.toBeUndefined(); // find() returns "undefined" if not found

		const newTabSettingLabelForAttr = newTabSettingLabel.getAttribute(
			'for'
		);
		const newTabSettingInput = container.querySelector(
			`#${ newTabSettingLabelForAttr }`
		);
		expect( newTabSettingInput ).not.toBeNull();
		expect( newTabSettingInput.checked ).toBe( false );
	} );

	it( 'should display a setting control with correct default state for each of the custom settings provided', async () => {
		const selectedLink = first( fauxEntitySuggestions );

		const customSettings = [
			{
				id: 'newTab',
				title: 'Open in New Tab',
			},
			{
				id: 'noFollow',
				title: 'No follow',
			},
		];

		const customSettingsLabelsText = customSettings.map(
			( setting ) => setting.title
		);

		const LinkControlConsumer = () => {
			const [ link ] = useState( selectedLink );

			return (
				<LinkControl
					value={ { ...link, newTab: false, noFollow: true } }
					settings={ customSettings }
				/>
			);
		};

		act( () => {
			render( <LinkControlConsumer />, container );
		} );

		// Grab the elements using user perceivable DOM queries
		const settingsLegend = Array.from(
			container.querySelectorAll( 'legend' )
		).find(
			( legend ) =>
				legend.innerHTML &&
				legend.innerHTML.includes( 'Currently selected link settings' )
		);
		const settingsFieldset = settingsLegend.closest( 'fieldset' );
		const settingControlsLabels = Array.from(
			settingsFieldset.querySelectorAll( 'label' )
		);
		const settingControlsInputs = settingControlsLabels.map( ( label ) => {
			return settingsFieldset.querySelector(
				`#${ label.getAttribute( 'for' ) }`
			);
		} );

		const settingControlLabelsText = Array.from(
			settingControlsLabels
		).map( ( label ) => label.innerHTML );

		// Check we have the correct number of controls
		expect( settingControlsLabels ).toHaveLength( 2 );

		// Check the labels match
		expect( settingControlLabelsText ).toEqual(
			expect.arrayContaining( customSettingsLabelsText )
		);

		// Assert the default "checked" states match the expected
		expect( settingControlsInputs[ 0 ].checked ).toEqual( false );
		expect( settingControlsInputs[ 1 ].checked ).toEqual( true );
	} );
} );
