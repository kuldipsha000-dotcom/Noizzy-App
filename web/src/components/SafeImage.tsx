import { useState, useEffect } from 'react';
import type { ImgHTMLAttributes } from 'react';
import { Music } from 'lucide-react';

interface SafeImageProps extends ImgHTMLAttributes<HTMLImageElement> {
    fallbackIcon?: React.ReactNode;
    maxRetries?: number;
}

const SafeImage = ({ 
    src, 
    alt, 
    className, 
    fallbackIcon = <Music className="w-1/2 h-1/2 text-[#b3b3b3]" />,
    maxRetries = 3,
    ...props 
}: SafeImageProps) => {
    const [imgSrc, setImgSrc] = useState<string | undefined>(src);
    const [retryCount, setRetryCount] = useState(0);
    const [hasFailed, setHasFailed] = useState(false);

    // Reset state if the requested src changes
    useEffect(() => {
        setImgSrc(src);
        setRetryCount(0);
        setHasFailed(false);
    }, [src]);

    const handleError = () => {
        if (!src) {
            setHasFailed(true);
            return;
        }

        if (retryCount < maxRetries) {
            // Force browser to retry fetching the image by appending a cache busting query param
            const joinChar = src.includes('?') ? '&' : '?';
            setImgSrc(`${src}${joinChar}retry=${retryCount + 1}`);
            setRetryCount(prev => prev + 1);
        } else {
            setHasFailed(true);
        }
    };

    if (hasFailed || !imgSrc) {
        return (
            <div className={`flex items-center justify-center bg-black/20 ${className}`}>
                {fallbackIcon}
            </div>
        );
    }

    return (
        <img
            {...props}
            src={imgSrc}
            alt={alt || "Image"}
            className={className}
            onError={handleError}
        />
    );
};

export default SafeImage;
