import { useContext, useEffect, useId, useMemo } from 'react';
import useImage from 'use-image';
import { ObjectLoadingContext } from './ObjectLoadingContext';
import { wrapImageUrl } from './util/cos';

/**
 * Delays taking a screenshot until loading == false.
 */
export function useObjectLoading(loading: boolean) {
    const id = useId();
    const { setLoading, clearLoading } = useContext(ObjectLoadingContext);

    useEffect(() => {
        if (loading) {
            setLoading(id);

            return () => {
                clearLoading(id);
            };
        }
    }, [id, loading, setLoading, clearLoading]);
}

type UseImageType = typeof useImage;

/**
 * useImage(), but delays taking a screenshot until the image finishes loading,
 * and crossOrigin defaults to "anonymous" to avoid tainting the canvas.
 */
export const useImageTracked: UseImageType = (url, crossOrigin = 'anonymous', referrerPolicy = undefined) => {
    // 监听 COS 配置变化，确保配置就绪后重新计算 wrappedUrl 并触发 useImage 重新加载
    const wrappedUrl = useMemo(() => (url ? wrapImageUrl(url) : url), [url]);
    const [image, status] = useImage(wrappedUrl, crossOrigin, referrerPolicy);

    useObjectLoading(!!wrappedUrl && status === 'loading');

    return [image, status];
};
