/**
 * WordPress dependencies
 */
import { useSelect } from '@wordpress/data';
import { useRef } from '@wordpress/element';

/**
 * Internal dependencies
 */
import BlockMover from '../block-mover';
import BlockSwitcher from '../block-switcher';
import BlockControls from '../block-controls';
import BlockFormatControls from '../block-format-controls';
import BlockSettingsMenu from '../block-settings-menu';
import { useShowMoversGestures, getIsSmallerViewport } from './utils';

export default function BlockToolbar( { hideDragHandle } ) {
	const {
		blockClientIds,
		isValid,
		mode,
		moverDirection,
		hasMovers = true,
	} = useSelect( ( select ) => {
		const {
			getBlockMode,
			getSelectedBlockClientIds,
			isBlockValid,
			getBlockRootClientId,
			getBlockListSettings,
		} = select( 'core/block-editor' );
		const selectedBlockClientIds = getSelectedBlockClientIds();
		const blockRootClientId = getBlockRootClientId(
			selectedBlockClientIds[ 0 ]
		);

		const { __experimentalMoverDirection, __experimentalUIParts = {} } =
			getBlockListSettings( blockRootClientId ) || {};

		return {
			blockClientIds: selectedBlockClientIds,
			rootClientId: blockRootClientId,
			isValid:
				selectedBlockClientIds.length === 1
					? isBlockValid( selectedBlockClientIds[ 0 ] )
					: null,
			mode:
				selectedBlockClientIds.length === 1
					? getBlockMode( selectedBlockClientIds[ 0 ] )
					: null,
			moverDirection: __experimentalMoverDirection,
			hasMovers: __experimentalUIParts.hasMovers,
		};
	}, [] );

	const containerNodeRef = useRef();
	const nodeRef = useRef();

	const {
		showMovers,
		gestures: showMoversGestures,
	} = useShowMoversGestures( { ref: nodeRef } );

	const shouldShowVisualToolbar = isValid && mode === 'visual';
	const isMultiToolbar = blockClientIds.length > 1;

	const shouldShowMovers =
		getIsSmallerViewport() || ( showMovers && hasMovers );

	const animatedMoverStyles = {
		opacity: shouldShowMovers ? 1 : 0,
		transform: shouldShowMovers ? 'translateX(0px)' : 'translateX(100%)',
	};

	return (
		<div className="block-editor-block-toolbar" ref={ containerNodeRef }>
			<div
				className="block-editor-block-toolbar__mover-switcher-container"
				ref={ nodeRef }
			>
				<div
					className="block-editor-block-toolbar__mover-trigger-container"
					{ ...showMoversGestures }
				>
					<div
						className="block-editor-block-toolbar__mover-trigger-wrapper"
						style={ animatedMoverStyles }
					>
						<BlockMover
							clientIds={ blockClientIds }
							__experimentalOrientation={ moverDirection }
							hideDragHandle={ hideDragHandle }
						/>
					</div>
				</div>
				{ ( shouldShowVisualToolbar || isMultiToolbar ) && (
					<div
						{ ...showMoversGestures }
						className="block-editor-block-toolbar__block-switcher-wrapper"
					>
						<BlockSwitcher clientIds={ blockClientIds } />
					</div>
				) }
			</div>
			{ shouldShowVisualToolbar && ! isMultiToolbar && (
				<>
					<BlockControls.Slot
						bubblesVirtually
						className="block-editor-block-toolbar__slot"
					/>
					<BlockFormatControls.Slot
						bubblesVirtually
						className="block-editor-block-toolbar__slot"
					/>
				</>
			) }
			<BlockSettingsMenu clientIds={ blockClientIds } />
		</div>
	);
}
