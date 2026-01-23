import React from 'react';
import { Dialog, DialogSurface, DialogBody, makeStyles, tokens } from '@fluentui/react-components';
import { CommunityPanel } from './CommunityPanel';

interface CommunityDialogProps {
    open: boolean;
    onClose: () => void;
}

export const CommunityDialog: React.FC<CommunityDialogProps> = ({ open, onClose }) => {
    const classes = useStyles();

    return (
        <Dialog
            open={open}
            onOpenChange={(e, data) => {
                if (!data.open) {
                    onClose();
                }
            }}
        >
            <DialogSurface className={classes.surface}>
                <DialogBody className={classes.body}>
                    <CommunityPanel onDownloadSuccess={onClose} />
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};

const useStyles = makeStyles({
    surface: {
        maxWidth: '90vw',
        width: '1400px',
        maxHeight: '90vh',
        height: '746px',
        padding: 0,
        borderRadius: tokens.borderRadiusXLarge,
        boxShadow: tokens.shadow64,
    },
    body: {
        padding: 0,
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
    },
});
